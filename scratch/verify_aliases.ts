// scratch/verify_aliases.ts
import { supabase } from '../src/lib/supabase';

const { data } = await supabase
  .from('products')
  .select('id, name, slug, search_aliases')
  .in('slug', ['youtube-premium', 'youku-vip', 'tv360-standard']);

console.log('Aliases from anon client:');
data?.forEach(p => console.log(`${p.name}: ${JSON.stringify(p.search_aliases)}`));
