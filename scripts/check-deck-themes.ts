import path from 'node:path';
import { checkDeckAssets } from '../lib/check-deck-assets';

checkDeckAssets(path.resolve('public'))
  .then((results) => results.forEach((result) => console.log(result)))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
