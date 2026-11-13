// Vitest runs outside the React Server Components bundler, which is what
// makes the real `server-only` package throw. This stub lets unit tests
// import the server env reader. Next.js still uses the real package.
