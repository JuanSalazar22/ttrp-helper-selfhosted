import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '@/db/queries';
import { upsertByName, healSpeciesLibrary } from '@/types/wfrp4e';
import { BASE_RACES } from '@/data/wfrp-races';
import type { WfrpSpeciesDef, WfrpOriginDef } from '@/types/wfrp4e';

const SPECIES_KEY = 'wfrp_species_library';
const ORIGIN_KEY = 'wfrp_origin_library';

export function useWfrpLibrary() {
  const db = useSQLiteContext();
  const [species, setSpecies] = useState<WfrpSpeciesDef[]>([]);
  const [origins, setOrigins] = useState<WfrpOriginDef[]>([]);

  useEffect(() => {
    let alive = true;
    getSetting(db, SPECIES_KEY).then(v => {
      if (!alive || !v) return;
      // Heal legacy entries that predate fields like fate/resilience/extraPoints so
      // they can't shadow a base race with blank values; re-persist if anything changed.
      const healed = healSpeciesLibrary(JSON.parse(v) as WfrpSpeciesDef[], BASE_RACES);
      setSpecies(healed);
      const out = JSON.stringify(healed);
      if (out !== v) setSetting(db, SPECIES_KEY, out);
    });
    getSetting(db, ORIGIN_KEY).then(v => { if (alive && v) setOrigins(JSON.parse(v)); });
    return () => { alive = false; };
  }, [db]);

  const addSpecies = useCallback((def: WfrpSpeciesDef) => {
    setSpecies(prev => {
      const next = upsertByName(prev, def);
      setSetting(db, SPECIES_KEY, JSON.stringify(next));
      return next;
    });
  }, [db]);

  const addOrigin = useCallback((def: WfrpOriginDef) => {
    setOrigins(prev => {
      const next = upsertByName(prev, def);
      setSetting(db, ORIGIN_KEY, JSON.stringify(next));
      return next;
    });
  }, [db]);

  return { species, origins, addSpecies, addOrigin };
}
