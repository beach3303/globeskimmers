// The Home rows client: one /home/rows call per ~10 km cell per 10 minutes.
import { callWorker } from "@/lib/callWorker";
import { ROUTE } from "@/lib/workerRoutes";
import { getSeason } from "@/lib/homeContext";

const _rowsCache = new Map(); // key -> { at, promise }
const ROWS_CLIENT_TTL_MS = 10 * 60 * 1000;

export function fetchHomeRows({ latitude, longitude, cityName = "", countryName = "" }) {
  const key = `${latitude.toFixed(1)},${longitude.toFixed(1)}`;
  const hit = _rowsCache.get(key);
  if (hit && Date.now() - hit.at < ROWS_CLIENT_TTL_MS) return hit.promise;
  const promise = callWorker(ROUTE.getHomeRows, {
    latitude,
    longitude,
    localHour: new Date().getHours(),
    season: getSeason(new Date(), latitude),
    cityName,
    countryName,
  }).then((res) => {
    if (!res || res.error) _rowsCache.delete(key);
    return res;
  });
  _rowsCache.set(key, { at: Date.now(), promise });
  return promise;
}
