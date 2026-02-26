import { Gender } from '../models';
import { Rng } from './rng';

const MALE = [
  'Alyn','Addam','Boremund','Cregan','Damon','Edric','Garlan','Harrold','Jon','Lyonel',
  'Orys','Quentyn','Ryman','Steffon','Theomar','Trystane','Willas','Yohn','Benjen','Ronnel'
];

const FEMALE = [
  'Alys','Arianne','Bethany','Cassandra','Elaena','Jeyne','Lynesse','Margaery','Myrcella','Nymeria',
  'Rhaena','Rhaenyra','Sansa','Shiera','Talla','Ysilla','Rowena','Lysa','Elinor','Rylene'
];

const MALE_EPITHETS = [
  'o Prudente', 'o Jovem', 'o Silencioso', 'o Honrado', 'o Astuto', 'o Valente', 'o Elegante'
];

const FEMALE_EPITHETS = [
  'a Prudente', 'a Jovem', 'a Silenciosa', 'a Honrada', 'a Astuta', 'a Valente', 'a Elegante'
];

export function genFirstName(rng: Rng, gender: Gender): string {
  return rng.pick(gender === 'M' ? MALE : FEMALE);
}

export function maybeEpithet(rng: Rng, gender: Gender): string {
  const pool = gender === 'M' ? MALE_EPITHETS : FEMALE_EPITHETS;
  return rng.chance(0.18) ? ` ${rng.pick(pool)}` : '';
}
