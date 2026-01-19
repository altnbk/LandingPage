# LandingForge - AI-Powered Landing Page SaaS

Create and deploy beautiful landing pages in minutes, powered by AI.

## Tech Stack

- **Frontend:** Astro + React + TailwindCSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **AI:** OpenAI GPT-4
- **Deployment:** Cloudflare Pages + Workers
- **Payments:** Stripe

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase account
- OpenAI API key
- Cloudflare account

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd LandingPage
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your actual API keys
```

4. Run development server
```bash
npm run dev
```

Visit http://localhost:4321

## Project Structure

```
/src
  /pages          # Routes
  /components     # React components
  /templates      # Landing page templates
  /layouts        # Page layouts
  /lib           # Utilities
  /styles        # Global styles
```

## Development

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Documentation

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed project documentation.

## License

MIT
