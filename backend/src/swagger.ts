import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const description = `
API de **GuildGamer**: encontrar jugadores, crear sesiones y comunicarse antes de jugar.

**Autenticación:** registra o inicia sesión en \`/auth\`, copia el \`accessToken\`
y haz clic en *Authorize*. Las rutas marcadas sin candado son públicas.

**Tiempo real (Socket.IO)** — conecta con \`io(url + '/<namespace>', { auth: { token } })\`:

| Namespace | Envías | Recibes |
|---|---|---|
| \`/chat\` | \`session:join\`, \`session:leave\`, \`message:send\`, \`typing\`, \`dm:send\` | \`message:new\`, \`typing\`, \`member:joined\`, \`member:left\`, \`session:removed\`, \`session:cancelled\`, \`session:status\`, \`dm:new\` |
| \`/notifications\` | — | \`notification:new\` |
| \`/voice\` | \`voice:join\`, \`voice:leave\`, \`voice:signal\`, \`voice:state\` | \`voice:peer-joined\`, \`voice:peer-left\`, \`voice:signal\`, \`voice:state\` |
`;

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('GuildGamer API')
    .setDescription(description)
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    jsonDocumentUrl: 'docs/json',
  });
}
