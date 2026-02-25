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

const EPITHETS = [
  'o Prudente', 'a Astuta', 'o Jovem', 'a Serena', 'o Silencioso', 'a Valente', 'o Honrado', 'a Elegante'
];

export function genFirstName(rng: Rng, gender: Gender): string {
  return rng.pick(gender === 'M' ? MALE : FEMALE);
}

export function maybeEpithet(rng: Rng): string {
  return rng.chance(0.18) ? ` ${rng.pick(EPITHETS)}` : '';
}
