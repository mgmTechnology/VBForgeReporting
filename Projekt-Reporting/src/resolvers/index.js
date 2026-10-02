import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getText', (req) => {
  console.log(req);
  return 'Fortsetzung nächste Woche Dienstag.';
});

export const handler = resolver.getDefinitions();
