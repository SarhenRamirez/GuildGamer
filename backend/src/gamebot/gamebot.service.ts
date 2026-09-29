import { Injectable } from '@nestjs/common';
import { GREETING_KEYWORDS, KNOWLEDGE, type KnowledgeEntry } from './knowledge.js';

const STOPWORDS = new Set(
  'a al como con cual de del el en es la las lo los me mi mis para por que se si su un una unos unas y o yo tu te hay puedo quiero hacer'.split(' '),
);

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));

const stemMatches = (keywordWord: string, questionWord: string) => {
  if (keywordWord.length <= 3) return questionWord === keywordWord;
  const stem = keywordWord.slice(0, Math.max(3, keywordWord.length - 2));
  return questionWord.startsWith(stem);
};

const DEFAULT_SUGGESTIONS = ['crear-sesion', 'encontrar-jugadores', 'crossplay', 'premium'];

@Injectable()
export class GamebotService {
  private readonly index = KNOWLEDGE.map((entry) => ({
    entry,
    keywords: entry.keywords.map(words).filter((k) => k.length),
  }));

  ask(question: string) {
    const q = words(question);
    const has = (kw: string) => q.some((w) => stemMatches(kw, w));

    const ranked = this.index
      .map(({ entry, keywords }) => ({
        entry,
        score: keywords
          .filter((k) => k.every(has))
          .reduce((sum, k) => sum + k.length, 0),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length) {
      const best = ranked[0].entry;
      return {
        answer: best.answer,
        matched: best.id,
        suggestions: this.suggest(ranked.slice(1, 4).map((r) => r.entry), best.id),
      };
    }

    const raw = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isGreeting = GREETING_KEYWORDS.some((g) => raw.includes(g));
    return {
      answer: isGreeting
        ? '¡Hola! Soy GameBot 🎮. Puedo ayudarte a usar GuildGamer (crear sesiones, encontrar jugadores, chat de voz, Premium…) y explicarte conceptos de videojuegos. ¿Qué quieres saber?'
        : 'No estoy seguro de haberte entendido. Prueba con alguna de estas preguntas o reformula la tuya con otras palabras.',
      matched: null,
      suggestions: this.suggest([], null),
    };
  }

  private suggest(related: KnowledgeEntry[], exclude: string | null) {
    const ids = [...related.map((e) => e.id), ...DEFAULT_SUGGESTIONS].filter(
      (id, i, all) => id !== exclude && all.indexOf(id) === i,
    );
    return ids.slice(0, 3).map((id) => KNOWLEDGE.find((e) => e.id === id)!.question);
  }

  topics() {
    return KNOWLEDGE.map((e) => e.question);
  }
}
