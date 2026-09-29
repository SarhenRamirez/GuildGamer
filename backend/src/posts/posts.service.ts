import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { fileSelect, FilesService } from '../files/files.service.js';
import { FriendsService } from '../friends/friends.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationType, Role } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCommentDto, CreatePostDto, FeedQueryDto } from './posts.dto.js';

const author = { select: { id: true, username: true, avatarUrl: true } } as const;
const authorWithGames = {
  select: { id: true, username: true, avatarUrl: true, games: { select: { gameId: true, rank: true } } },
} as const;

const postSelect = (viewerId: string) =>
  ({
    id: true,
    kind: true,
    content: true,
    createdAt: true,
    game: { select: { id: true, name: true, slug: true } },
    author: authorWithGames,
    files: { select: fileSelect },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { userId: true } },
  }) satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

const toPost = ({ _count, likes, author: { games, ...author }, ...post }: PostRow) => ({
  ...post,
  author,
  authorRank: post.game ? (games.find((g) => g.gameId === post.game!.id && g.rank)?.rank ?? null) : null,
  likeCount: _count.likes,
  commentCount: _count.comments,
  likedByMe: likes.length > 0,
});

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly friends: FriendsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreatePostDto, user: AuthUser) {
    const fileIds = [...new Set(dto.fileIds ?? [])];
    if (!dto.content && !fileIds.length) {
      throw new BadRequestException('La publicación necesita texto o algún archivo');
    }
    if (dto.gameId && !(await this.prisma.game.count({ where: { id: dto.gameId } }))) {
      throw new BadRequestException('Juego no encontrado');
    }
    if (fileIds.length) {
      const usable = await this.prisma.file.count({
        where: { id: { in: fileIds }, ownerId: user.id, postId: null },
      });
      if (usable !== fileIds.length) {
        throw new BadRequestException('Algún archivo no existe, no es tuyo o ya está publicado');
      }
    }
    const post = await this.prisma.post.create({
      data: {
        authorId: user.id,
        kind: dto.kind,
        gameId: dto.gameId,
        content: dto.content || null,
        files: { connect: fileIds.map((id) => ({ id })) },
      },
      select: postSelect(user.id),
    });
    return toPost(post);
  }

  async feed(query: FeedQueryDto, viewer: AuthUser) {
    const authors =
      query.feed === 'friends' ? [viewer.id, ...(await this.friends.friendIds(viewer.id))] : undefined;
    const rows = await this.prisma.post.findMany({
      where: {
        authorId: query.authorId ?? (authors ? { in: authors } : undefined),
        author: { isBanned: false },
        kind: query.kind,
        gameId: query.gameId,
        createdAt: query.before ? { lt: query.before } : undefined,
      },
      select: postSelect(viewer.id),
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
    return rows.map(toPost);
  }

  async findOne(id: string, viewer: AuthUser) {
    const post = await this.prisma.post.findUnique({ where: { id }, select: postSelect(viewer.id) });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    return toPost(post);
  }

  async remove(id: string, actor: AuthUser) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true, files: { select: { id: true, storageKey: true } } },
    });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    if (post.authorId !== actor.id && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Solo el autor o un admin pueden borrarla');
    }
    await this.prisma.$transaction([
      this.prisma.file.deleteMany({ where: { id: { in: post.files.map((f) => f.id) } } }),
      this.prisma.post.delete({ where: { id } }),
    ]);
    await this.files.removeMany(post.files.map((f) => f.storageKey));
  }

  async like(id: string, user: AuthUser) {
    const post = await this.prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    const { count } = await this.prisma.postLike.createMany({
      data: { postId: id, userId: user.id },
      skipDuplicates: true,
    });
    if (count && post.authorId !== user.id) {
      const { username } = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { username: true },
      });
      await this.notifications.notify([post.authorId], {
        type: NotificationType.POST_LIKED,
        title: `A ${username} le gusta tu publicación`,
        data: { postId: id, userId: user.id },
      });
    }
    return this.likeState(id, user.id);
  }

  async unlike(id: string, user: AuthUser) {
    await this.prisma.postLike.deleteMany({ where: { postId: id, userId: user.id } });
    return this.likeState(id, user.id);
  }

  async comments(postId: string) {
    await this.assertExists(postId);
    return this.prisma.postComment.findMany({
      where: { postId },
      select: { id: true, content: true, createdAt: true, author },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async comment(postId: string, dto: CreateCommentDto, user: AuthUser) {
    const post = await this.assertExists(postId);
    const comment = await this.prisma.postComment.create({
      data: { postId, authorId: user.id, content: dto.content },
      select: { id: true, content: true, createdAt: true, author },
    });
    if (post.authorId !== user.id) {
      await this.notifications.notify([post.authorId], {
        type: NotificationType.POST_COMMENTED,
        title: `${comment.author.username} comentó tu publicación`,
        body: dto.content.length > 80 ? `${dto.content.slice(0, 77)}…` : dto.content,
        data: { postId, commentId: comment.id, userId: user.id },
      });
    }
    return comment;
  }

  async removeComment(postId: string, commentId: string, actor: AuthUser) {
    const c = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId },
      select: { authorId: true, post: { select: { authorId: true } } },
    });
    if (!c) throw new NotFoundException('Comentario no encontrado');
    if (actor.id !== c.authorId && actor.id !== c.post.authorId && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('No puedes borrar este comentario');
    }
    await this.prisma.postComment.delete({ where: { id: commentId } });
  }

  private async likeState(postId: string, userId: string) {
    const [likeCount, mine] = await Promise.all([
      this.prisma.postLike.count({ where: { postId } }),
      this.prisma.postLike.count({ where: { postId, userId } }),
    ]);
    return { likeCount, likedByMe: mine > 0 };
  }

  private async assertExists(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    return post;
  }
}
