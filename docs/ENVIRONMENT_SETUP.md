# Environment Variable Setup

This app uses environment variables to securely manage API keys and configuration.

## Setup Instructions

1. **Copy the example file**: 
   ```bash
   cp .env.example .env.local
   ```

2. **Add your Supabase credentials**:
   - Go to your [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Go to Settings → API
   - Copy the **Project URL** and **anon public** key
   - Paste them into your `.env.local` file

3. **File Structure**:
   - `.env.local` - Your local environment variables (never commit this)
   - `.env.example` - Template file showing required variables
   - `.env.production` - Production environment variables (if needed)

## Required Variables

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Public anonymous key for Supabase | Supabase Dashboard → Settings → API |

## Security Notes

- **NEVER** commit `.env.local` or any file containing real API keys
- The `.gitignore` file is configured to exclude all `.env*` files except `.env.example`
- Use different API keys for development and production environments
- Rotate keys regularly for production environments

## Troubleshooting

If you get an error about missing environment variables:

1. Ensure `.env.local` exists in the project root
2. Check that all required variables are set
3. Restart Metro bundler after changing environment variables:
   ```bash
   npx react-native start --reset-cache
   ```

## Implementation Details

This project uses `react-native-dotenv` to load environment variables. The configuration is in:
- `babel.config.js` - Babel plugin configuration
- `env.d.ts` - TypeScript declarations for environment variables