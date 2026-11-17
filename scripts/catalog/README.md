# Exercise catalog

Builds `apps/web/public/catalog/exercises.es.v1.json`, the static exercise catalog every user gets (KTD11). It is not stored in the database and never syncs. Only custom exercises sync.

## Source and license

- Data: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), 1,324 records. The names, muscles, equipment and instruction text are MIT licensed, so we use them, including the Spanish instruction steps.
- Media: the dataset's images and GIFs are © Gym visual (https://gymvisual.com/, the dataset's `attribution` field). They are **not** MIT, and we do **not** use them. Every catalog entry ships `imageUrl: null`.
- Each entry keeps the dataset's `mediaId`, so images can be turned on once a Gym visual license exists. Nothing else in the app has to change. To turn them on:
  1. Get the license, and check what attribution it requires.
  2. Upload the licensed files to the public Blob store (KTD11).
  3. In `import.ts`, set `imageUrl` from `mediaId`, show the attribution in the app as the license requires, and regenerate. If the URL format changes, bump the file version (`v2`).

## Regenerate

```sh
pnpm --filter api exec tsx ../../scripts/catalog/import.ts <path-to-exercises.json>
```

(`tsx` is installed in `apps/api`. `pnpm exec tsx scripts/catalog/import.ts …` works from the root only once tsx is there.)

The script treats the input as untrusted data. It only parses the JSON and reads fields from it. The script fails if:

- a dataset `target` or `secondary_muscles` value is missing from `muscle-map.ts`;
- a kept exercise has no Spanish name in `translations.es.json`. The error lists every missing id with its English name.

The output has one entry per line, so diffs stay readable when the file is regenerated.

## Output fields

`CatalogExercise` (`packages/domain/src/types.ts`) plus extra fields:

| Field | Value |
|---|---|
| `id` | `cat-<dataset id>` |
| `name` | Spanish name from `translations.es.json` |
| `nameEn` | Original English name, used as a search alias. The dataset's broken `в°` is fixed to `°`. |
| `primaryMuscle` / `secondaryMuscles` | Ids from the fixed muscle list (R17); see below |
| `equipment` | One of the six groups; see below |
| `trackingType` | `weight_reps`, `reps` or `time`; see below |
| `imageUrl` | Always `null` (see license) |
| `mediaId` | The dataset's media id |
| `instructionsEs` | `instruction_steps.es`, or `.en` if the Spanish steps are missing |

## Dropped exercises (31)

Cardio is out of scope, so these are dropped:

- every exercise whose `target` is `cardiovascular system`;
- every exercise on a cardio machine (`upper body ergometer`, `skierg machine`, `stationary bike`, `elliptical machine`, `stepmill machine`). These are distance or calorie work, which fits none of the three tracking types.

## Muscles

`muscle-map.ts` holds the full table. Mappings that need a reason:

| Dataset | Muscle id | Why |
|---|---|---|
| `pectorals`, `upper chest` | `chest` | |
| `delts`, `deltoids`, `rear deltoids`, `rotator cuff` | `shoulders` | |
| `upper back`, `back`, `rhomboids` | `middle_back` | |
| `spine`, `lower back` | `lower_back` | |
| `serratus anterior` | `chest` | Only scapula push-ups and incline shoulder raises use it |
| `levator scapulae`, `sternocleidomastoid` | `neck` | |
| `hip flexors` | `quadriceps` | The rectus femoris is the hip flexor on the map |
| `obliques`, `core`, `lower abs` | `abdominals` | |
| `brachialis` | `biceps` | |
| `wrists`, `wrist flexors/extensors`, `grip muscles` | `forearms` | |
| `groin`, `inner thighs` | `adductors` | |
| `soleus` | `calves` | |
| `ankle stabilizers`, `ankles`, `feet`, `hands`, `shins` | dropped from secondaries | Not on the muscle map |

Secondary muscles are de-duplicated, and the primary muscle is removed from them.

## Equipment

| Dataset equipment | Group |
|---|---|
| `barbell`, `olympic barbell`, `ez barbell`, `trap bar` | `barbell` |
| `dumbbell` | `dumbbell` |
| `cable`, `rope` | `cable` |
| `smith machine`, `leverage machine`, `sled machine` | `machine` |
| `body weight`, `assisted`, `weighted` | `bodyweight` |
| everything else (`band`, `resistance band`, `kettlebell`, `medicine ball`, `stability ball`, `bosu ball`, `roller`, `wheel roller`, `hammer`, `tire`) | `other` |

The Smith machine counts as `machine` because the bar runs on a fixed guide.

## Tracking type

The rules run in this order:

1. **`time`** if the English name describes a static position: `plank`, `hold`, `wall sit`, `isometric`, `stretch`, `dead hang`, `l-sit`, `v-sit`, `side bridge v`, `planche`, `front lever`, `back lever`, `maltese`, `handstand`, `flag`, `pose`, `sphinx`, `upward facing dog`. The rule does not apply when the name also has a movement word (`twist`, `tap`, `fly`, `lift`, `push-up`, `jack`, `march`, `wipers`, `clean`, `rotation`, `reach`, `dynamic`, `reps`). For example, "front plank with twist", "planche push-up" and "kettlebell hang clean" are not `time`. A bare `lever` is not in the list, because machine names start with "lever".
2. **`reps`** if the dataset equipment carries no external load: `body weight`, `assisted`, `band`, `resistance band`, `stability ball`, `bosu ball`, `roller`, `wheel roller`, `hammer`, `tire`.
3. **`weight_reps`** for everything else, including `weighted` (added load: weighted pull-ups, dips…), kettlebell and medicine ball.

## Spanish names

`translations.es.json` maps each kept dataset id to a short Spanish name, using the usual terms in Spanish and Latin American gyms ("Press de banca con barra", "Elevación lateral con mancuernas", "Dominada"). Gym jargon that people use in English stays in English: Pallof, pull through, thruster, muscle-up, front lever, landmine. Video-variant suffixes are handled like this:

- `(male)` is left out of the Spanish name;
- `(female)` becomes `(mujer)`;
- `(back pov)` / `(side pov)` become `(vista posterior)` / `(vista lateral)`.

## Tests

```sh
pnpm vitest run --config scripts/catalog/vitest.config.ts
```

- `muscle-map.test.ts`: every mapped value is on the fixed list, and an unknown value throws.
- `catalog.test.ts`: checks the committed JSON. Every entry has muscles from the fixed list, one of the three tracking types, `imageUrl` null and a Spanish name. It also checks that no cardio exercise is left.

The root `vitest.config.ts` only lists `packages/*` and `apps/*` as projects, so `pnpm test` does not run these tests yet. That needs `scripts/catalog` added to the root project list.
