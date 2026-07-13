import Resolver from '@forge/resolver';

// Registers the app's backend functions. Each `define` call creates a named
// RPC endpoint the frontend invokes via `invoke('<key>', payload)` from
// @forge/bridge — the key is the route; there is no HTTP server here.
const resolver = new Resolver();

// Placeholder resolver from the template; replaced as real features land.
// Payload arrives on req.payload, caller identity on req.context.accountId.
resolver.define<{ example: string }, string>('getText', (req) => {
  console.log(req);

  return 'Hello, world!';
});

export const handler = resolver.getDefinitions();
