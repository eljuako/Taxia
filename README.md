# TaxIA — Landing + Chat tributario RD

Plataforma SaaS de consulta tributaria con IA para República Dominicana.
Frontend estático (HTML/CSS/JS) + endpoint serverless en Vercel que proxea Dify.

## Stack

- **Frontend**: HTML + CSS + JS vanilla
- **Auth + DB**: Supabase (PKCE + Google OAuth + tabla `profiles` con RLS)
- **IA / RAG**: Dify (a través de un Edge Function propio que esconde la API key)
- **Pagos**: PayPal Subscriptions
- **Hosting**: Vercel (auto-deploy desde GitHub)

## Estructura

```
.
├── index.html          # Landing + app console (single page)
├── api/
│   └── chat.js         # Vercel Edge Function — proxy hacia Dify
├── css/
│   ├── theme.css
│   ├── layout.css
│   └── app.css
├── js/
│   ├── config.js       # Constantes (sin secrets)
│   ├── auth.js         # Supabase auth
│   ├── chat.js         # Cliente del chat → llama /api/chat
│   ├── calculadoras.js # Simuladores ITBIS / IR-1 / etc.
│   └── app.js          # Orquestación UI
├── vercel.json
└── .gitignore
```

## Variables de entorno (configurar en Vercel)

En **Vercel Dashboard → tu proyecto → Settings → Environment Variables** agregar:

| Nombre | Valor | Entornos |
|--------|-------|----------|
| `DIFY_API_KEY` | `app-aSUCW2Lvn1EW87z2jxLXVAwj` | Production, Preview, Development |

Después del primer deploy, cualquier cambio a esta variable requiere un re-deploy.

> ⚠️ **NO** subas la key al repositorio. Solo vive en Vercel.

## Deploy

Cada push a `main` despliega automáticamente.

```bash
git add .
git commit -m "tu mensaje"
git push origin main
```

## Local dev

Para probar localmente con la edge function:

```bash
npm i -g vercel
vercel dev
```

Esto levanta el sitio en `http://localhost:3000` con `/api/chat` funcional (necesita
la variable `DIFY_API_KEY` en un archivo `.env.local` o en `vercel env pull`).
