-- Migration 002: seed 12 dog profiles
-- Run AFTER migration 001 (profiles table must exist).
-- Assumes dogs table already exists with columns:
--   id serial pk, name text, breed text, sex char(1), age_years int,
--   weight_lbs int, dist_miles int, verified boolean, emoji text,
--   grad jsonb, temperament text[], health jsonb, bio text,
--   owner_id uuid, created_at timestamptz
-- If column names differ, adjust below to match your actual schema.

insert into public.dogs
  (name, breed, sex, age_years, weight_lbs, dist_miles, verified, emoji, grad, temperament, health, bio)
values
  ('Luna','Golden Retriever','F',3,62,4,true,'🦮',
   '["#f6b26b","#e8734a"]',
   array['Gentle','Social','Eager to please'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["DNA panel","ok"]]'::jsonb,
   'Sweet-natured Golden with champion bloodlines and a full health vault. Loves water, kids, and long fetch sessions.'),

  ('Duke','German Shepherd','M',4,78,7,true,'🐕‍🦺',
   '["#8d6e63","#4e342e"]',
   array['Loyal','Confident','Trainable'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["Degenerative myelopathy test","ok"]]'::jsonb,
   'Working-line Shepherd with excellent structure and verified hip scores. Calm around other dogs, superb temperament.'),

  ('Bella','French Bulldog','F',2,24,3,true,'🐶',
   '["#b0a1c9","#7e6ba0"]',
   array['Playful','Affectionate','Adaptable'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["BOAS respiratory assessment","ok"],["Spine X-ray","ok"]]'::jsonb,
   'Health-tested Frenchie — including the breathing assessment most listings skip. Compact, cheerful, and city-proof.'),

  ('Rocky','Labrador Retriever','M',5,74,11,true,'🦴',
   '["#f9d976","#f39c12"]',
   array['Steady','Friendly','Food-driven'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["EIC test","ok"]]'::jsonb,
   'Proven sire with two healthy litters on record. Classic Lab temperament — patient, gentle, endlessly good-natured.'),

  ('Daisy','Poodle (Standard)','F',3,48,9,true,'🐩',
   '["#f8bbd0","#e57398"]',
   array['Smart','Elegant','Athletic'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","ok"],["PRA eye test","ok"]]'::jsonb,
   'Standard Poodle with clear eye tests and a show-quality coat. Whip-smart and wonderful with new people.'),

  ('Zeus','Siberian Husky','M',2,55,15,false,'🐺',
   '["#90caf9","#4a7ab5"]',
   array['Energetic','Vocal','Adventurous'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","pend"],["Eye exam","pend"]]'::jsonb,
   'Gorgeous bi-eyed Husky. Health verification in progress — hip and eye results expected soon via our vet partner program.'),

  ('Rosie','Golden Retriever','F',4,60,18,true,'🦮',
   '["#ffcc80","#ef8f4e"]',
   array['Calm','Nurturing','Devoted'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["Cardiac exam","ok"]]'::jsonb,
   'Experienced mom of one healthy litter. Full cardiac clearance — rare and valuable in the breed.'),

  ('Bruno','French Bulldog','M',3,27,22,false,'🐶',
   '["#bcaaa4","#795548"]',
   array['Chill','Comical','Cuddly'],
   '[["Vet wellness exam","ok"],["Vaccinations","pend"],["BOAS respiratory assessment","pend"],["Spine X-ray","pend"]]'::jsonb,
   'Charming brindle Frenchie enrolled in our Get-Healthy pathway — vet visits scheduled, verification pending.'),

  ('Maple','Labrador Retriever','F',2,63,27,true,'🦴',
   '["#d7a86e","#a86b32"]',
   array['Sweet','Curious','Gentle'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["OFA hips & elbows","ok"],["EIC test","ok"]]'::jsonb,
   'Fox-red Lab from health-focused lines. First-time listing from a family home, fully documented.'),

  ('Apollo','Poodle (Standard)','M',4,52,31,true,'🐩',
   '["#cfd8dc","#78909c"]',
   array['Poised','Clever','Social'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","ok"],["PRA eye test","ok"]]'::jsonb,
   'Silver Standard Poodle, AKC registered, clear on every breed-recommended screen.'),

  ('Nova','Siberian Husky','F',3,44,36,true,'🐺',
   '["#b3e5fc","#5a9bd4"]',
   array['Spirited','Independent','Affectionate'],
   '[["Vet wellness exam","ok"],["Vaccinations","ok"],["Hip evaluation","ok"],["Eye exam","ok"]]'::jsonb,
   'Stunning grey-and-white Husky with full clearances and a marathon engine. Loves cold mornings and new friends.'),

  ('Tank','German Shepherd','M',6,82,42,false,'🐕‍🦺',
   '["#a1887f","#5d4037"]',
   array['Protective','Mellow','Experienced'],
   '[["Vet wellness exam","pend"],["Vaccinations","ok"],["OFA hips & elbows","pend"],["DM test","pend"]]'::jsonb,
   'Retired working dog, new to the platform. Currently completing baseline verification with a partner vet.')

on conflict do nothing;
