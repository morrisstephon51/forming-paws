/**
 * The education hub's content, as data.
 *
 * Deliberately about *process and safety*, not veterinary judgement: what
 * paperwork the platform needs, what to ask a professional, and how to meet a
 * stranger safely. Forming Paws is not qualified to publish medical guidance,
 * and a page that reads like it is would be worse than no page — a member could
 * act on it instead of calling their vet.
 *
 * Nothing here is attributed to a vet, because no vet has reviewed it. When
 * partner vets exist and review this content, that claim can be added and not
 * before.
 */

/**
 * Which disclaimer a guide carries. "Not veterinary advice" is the wrong
 * sentence on a page about the Animal Welfare Act, and a vague notice covering
 * both would weaken the one that applies.
 */
export type GuideNotice = 'vet' | 'legal'

/** A document a reader can open and check for themselves. */
export type Source = { label: string; url: string }

export type Guide = {
  slug: string
  title: string
  summary: string
  /** Derived from the prose at 200 words per minute, rounded up, and pinned by a test. */
  readingMinutes: number
  notice: GuideNotice
  sections: { heading: string; body: string[] }[]
  /**
   * Present on any guide that states something about the law, veterinary
   * practice or a certification. A page that tells an owner what a statute
   * requires has to show the statute.
   */
  sources?: Source[]
}

export const GUIDES: Guide[] = [
  {
    slug: 'health-documents',
    title: 'What health documents you need, and why',
    summary:
      'The paperwork that unlocks matching, where to get it, and what our reviewers actually look at.',
    readingMinutes: 2,
    notice: 'vet',
    sections: [
      {
        heading: 'The baseline: two documents',
        body: [
          'Matching stays locked on Forming Paws until your dog has two things verified: a veterinary wellness exam dated within the last 12 months, and a record of core vaccinations.',
          'That is the floor, not the ceiling. It exists because an introduction between two dogs is a decision with consequences for animals that cannot consent to it, and the least we can do is confirm a professional has recently looked at both of them.',
        ],
      },
      {
        heading: 'Where these come from',
        body: [
          'Both come from your veterinarian. A wellness exam is an ordinary appointment. You do not need to ask for anything special or mention breeding to get one.',
          'If you have moved practices, your previous clinic can usually send records directly to your new one. Ask for the exam summary and the vaccination history as separate documents; it makes review faster.',
        ],
      },
      {
        heading: 'What our reviewers check',
        body: [
          'A person reads every document. They confirm it names your dog, that it comes from a veterinary practice, and that the date falls inside the window. They are not making a medical judgement about your dog.',
          'Anything unclear goes to manual follow-up rather than a silent rejection. If a document does not pass, you will be told why.',
        ],
      },
      {
        heading: 'If your dog does not pass',
        body: [
          'Not passing is not a rejection of your dog. The most common reasons are an exam that has aged past twelve months or a document that is missing a date.',
          'We are building a network of partner veterinarians so owners who need care to reach the baseline can get it affordably. That network does not exist yet, and we will not pretend otherwise, but it is the next thing we are building.',
        ],
      },
    ],
  },
  {
    slug: 'questions-for-your-vet',
    title: 'Questions worth asking your vet',
    summary:
      'A checklist to take to an appointment. These are prompts for a professional conversation, not answers.',
    readingMinutes: 2,
    notice: 'vet',
    sections: [
      {
        heading: 'Before you read this',
        body: [
          'Nothing on this page is veterinary advice, and Forming Paws is not qualified to give any. This is a list of questions to ask someone who is.',
          'Your vet knows your dog, their history, and their breed. We know none of those things.',
        ],
      },
      {
        heading: 'About your individual dog',
        body: [
          'Is my dog physically and behaviourally suited to breeding at all, and if not, would you tell me plainly?',
          'Is my dog at a healthy weight and condition right now?',
          'Are there findings in the recent exam I should understand better?',
        ],
      },
      {
        heading: 'About the breed',
        body: [
          'What health screenings are standard for this breed, beyond the baseline exam and vaccinations?',
          'Are there conditions common in this breed that testing can identify in advance?',
          'What would you want to know about the other dog before an introduction?',
        ],
      },
      {
        heading: 'About timing and frequency',
        body: [
          'Is my dog the right age, neither too young nor too old?',
          'How much recovery time between litters would you want to see?',
          'What would make you advise against it entirely?',
        ],
      },
      {
        heading: 'A note on the last one',
        body: [
          'That final question is the most useful one on this list, and the easiest to skip. A vet who says "I would not do this" is giving you the most valuable answer in the appointment.',
        ],
      },
    ],
  },
  {
    slug: 'meeting-safely',
    title: 'Meeting another owner safely',
    summary:
      'Chat unlocks on a mutual match. Here is how to handle the step after that, for you and for your dog.',
    readingMinutes: 2,
    notice: 'vet',
    sections: [
      {
        heading: 'Keep the first conversation in the app',
        body: [
          'Forming Paws chat opens only after both owners have expressed interest. Keeping the early conversation there means there is a record if something goes wrong, and it is what our moderation team can act on if you report someone.',
          'Moving to a personal number immediately is the single most common way a bad interaction becomes unreportable.',
        ],
      },
      {
        heading: 'Meet somewhere neutral first',
        body: [
          "A first meeting does not need to be at anyone's home. A neutral, public, daylight location, such as a park you both know or a vet practice car park, lets either person leave easily.",
          'Tell someone where you are going and when you expect to be back. This is ordinary advice for meeting any stranger from the internet, and it applies here.',
        ],
      },
      {
        heading: 'Bring the paperwork',
        body: [
          'Both owners should bring their dog documentation to the first meeting, even though both profiles are verified here. Seeing the originals is normal and asking for it is not rude.',
          'If someone is reluctant to show records they have already had verified, treat that as information.',
        ],
      },
      {
        heading: 'Watch the dogs, not the plan',
        body: [
          'Dogs communicate discomfort well before they escalate. If either dog is stressed, the meeting is over. That is not a setback, it is the system working.',
          'You are never obliged to continue because you agreed to in a chat.',
        ],
      },
      {
        heading: 'Reporting',
        body: [
          'Every conversation has a report option. Reports go to a real person, and the conversation is preserved for review, including if the other owner deletes their account.',
        ],
      },
    ],
  },
  {
    slug: 'illinois-law',
    title: 'What Illinois law asks of a breeder',
    summary:
      'Where the licensing line sits, the eight-week rule, what has to change hands at a sale, and the city registration nobody mentions.',
    readingMinutes: 4,
    notice: 'legal',
    sections: [
      {
        heading: 'Read this as a map, not as advice',
        body: [
          'This page points at the rules that apply to breeding and selling dogs in Illinois, and links the text of each one so you can read it yourself. It is not legal advice. Nobody here is a lawyer, and a real situation can turn on facts a web page cannot know.',
          'Local rules sit on top of state ones. A municipality can require things the state does not, and a lease or a condominium association can restrict what both of them allow.',
        ],
      },
      {
        heading: 'The line that decides whether you need a state license',
        body: [
          'The Animal Welfare Act defines a dog breeder as a person who sells, offers to sell, exchanges, or offers for adoption dogs they have produced and raised. Then it draws the line that decides most cases: a person who owns, has possession of, or harbors five or fewer females capable of reproduction is not a dog breeder under the Act.',
          'One litter from one or two dogs does not make you a licensed breeder. At six intact females you are one, and Section 3 requires a license from the Illinois Department of Agriculture before operating as one.',
          'Watch the vocabulary. The Act defines "offer for sale" to include advertising, bartering, auctioning and giving an animal away, so a free puppy is still an offer for sale in the language of the statute.',
        ],
      },
      {
        heading: 'Eight weeks, at the earliest',
        body: [
          'Section 2.2 says no dog dealer, dog breeder or cat breeder shall separate a puppy from its mother, for the purpose of sale, until the puppy has reached eight weeks of age.',
          'Those are defined terms, so an owner below the licensing line is not who that sentence is aimed at. Hold to eight weeks anyway. What a puppy learns from its mother and its littermates in those weeks is not available from anywhere else, and the veterinary behaviour literature treats this period as the one that shapes how a dog copes with everything after it.',
        ],
      },
      {
        heading: 'What the state expects to change hands at a sale',
        body: [
          'Section 3.1 lists what a licensed dog breeder or dealer must provide for every dog offered for sale: age, sex and weight; breed; a record of vaccinations and veterinary care; whether the dog has been sterilised; the name and address of the breeder; the name and address of anyone else who owned or harboured the dog before the sale; and documentation that the dog is microchipped and enrolled in a nationally searchable database.',
          'Below the licensing line that list does not bind you. Hand it over anyway. It is the state\u2019s own answer to what a buyer deserves to be told, and it is the cheapest credibility available to you.',
        ],
      },
      {
        heading: 'Rabies is not optional',
        body: [
          'The Animal Control Act requires every owner of a dog four months or older to have it inoculated against rabies by a licensed veterinarian, with a second vaccination within one year of the first, and later boosters governed by the licensed duration of the vaccine used.',
          'Your veterinarian files the certificate with the county, and that certificate carries the dog\u2019s microchip number if it has one. Keep your copy somewhere you can find it. City registration, boarding kennels and grooming appointments all ask for the same page.',
        ],
      },
      {
        heading: 'If you are in Chicago',
        body: [
          'Chicago requires a city dog license for every dog four months or older, under Municipal Code 7-12-140, and will not issue one without proof of current rabies vaccination.',
          'The fee is set by ordinance and is far lower for a sterilised dog. At the time of writing it is five dollars a year for a sterilised dog against fifty for an unsterilised one, with a reduced rate for senior citizens. The City Clerk issues the licence, online or in person, and publishes the current fees.',
          'Outside the city, check your own municipality. Registration, limits on the number of dogs in a household and kennel rules are all set locally, and they differ from one suburb to the next.',
        ],
      },
      {
        heading: 'The rules people quote that do not cover you',
        body: [
          'Two well known parts of the Act are aimed at shops. Section 3.8 allows a pet shop to offer a dog only if it came from a shelter or an animal control facility, and Section 3.15 sets out what a pet shop must disclose before a sale, along with the remedies a buyer gets when it does not.',
          'A person who sells only animals they produced and raised is excluded from the definition of a pet shop operator, so none of those buyer protections attach to a private sale. Nothing fills that gap except the agreement the two of you write, which is the next guide.',
        ],
      },
    ],
    sources: [
      {
        label: '225 ILCS 605/2, Animal Welfare Act definitions, including the five-female line',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K2',
      },
      {
        label: '225 ILCS 605/2.2, separation at eight weeks and licensee records',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K2%2E2',
      },
      {
        label: '225 ILCS 605/3, who must hold a license',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K3',
      },
      {
        label: '225 ILCS 605/3.1, information required for every dog offered for sale',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K3%2E1',
      },
      {
        label: '225 ILCS 605/3.15, disclosures and remedies for pet shop sales',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K3%2E15',
      },
      {
        label: '510 ILCS 5/8, rabies inoculation',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=051000050K8',
      },
      {
        label: 'Chicago City Clerk, dog registration and current fees',
        url: 'https://www.chicityclerk.com/dog-registration',
      },
    ],
  },
  {
    slug: 'written-agreements',
    title: 'Putting it in writing before the puppies exist',
    summary:
      'What a mating or placement agreement should cover, and why a private sale leaves you both with only the paper you wrote.',
    readingMinutes: 3,
    notice: 'legal',
    sections: [
      {
        heading: 'Paper, between people who get along',
        body: [
          'Every dispute in this corner of the world starts between two people who liked each other at the beginning. An agreement is not a sign of distrust. It is what lets a disagreement six months from now be about a document instead of two memories.',
          'It carries more weight here than in a shop sale. Illinois gives buyers specific remedies when a pet shop sells them a sick animal, but a person selling only dogs they raised is not a pet shop under the Act, so those remedies do not apply. What the two of you wrote down is what exists.',
          'This is not legal advice. If you plan to reuse an agreement, have a lawyer read it once.',
        ],
      },
      {
        heading: 'Name the dogs, not just the people',
        body: [
          'Registered names, call names, dates of birth, microchip numbers, and which health documents each side has already had verified. Attach copies rather than referring to them.',
          'Microchip numbers do the work here. Two dogs in the same pedigree often share most of a name, and a number does not.',
        ],
      },
      {
        heading: 'The mating itself',
        body: [
          'The stud fee and when it falls due. Whether it covers a repeat service if there is no pregnancy. Who travels and who pays for the travel. Who pays for timing tests or an artificial insemination. What happens if either dog is unwell on the day, or comes into season three weeks late.',
        ],
      },
      {
        heading: 'Puppies, money, and the things that go wrong',
        body: [
          'Pick order and how many puppies each side takes. What happens with a litter of one, and what happens with a litter of none.',
          'Who carries emergency veterinary costs and who has authority to approve them. A caesarean at two in the morning is the most expensive line in the whole enterprise, and it is the worst possible moment to discover that neither of you assumed it was yours.',
        ],
      },
      {
        heading: 'What goes home with each puppy',
        body: [
          'Use the state\u2019s list for licensed breeders as your template: age, sex and weight; breed; vaccination and veterinary records; sterilisation status; your name and address; anyone else who kept the puppy; and microchip documentation showing enrolment in a nationally searchable database.',
          'Add what the list leaves out. What the puppy has been eating and how often, the vet who has seen it, and a number the new owner can call when something worries them at ten at night.',
        ],
      },
      {
        heading: 'The clause people leave out',
        body: [
          'A take-back clause: you will take this dog back at any point in its life rather than let it reach a shelter. Put it in writing, with a phone number that will still work in eight years.',
          'It is the single clearest signal that you are placing a dog rather than selling a product, and the people you most want as buyers read it that way.',
        ],
      },
      {
        heading: 'Keep the file',
        body: [
          'Licensed breeders are required to keep records of the origin and sale of every dog, and to give buyers proof of pedigree. Below that line, keep the same file anyway: the agreement, the health documents, the microchip registration, and the dates.',
          'The person who wants it years later is usually the buyer, and being the breeder who still has it is worth more than any advertisement.',
        ],
      },
    ],
    sources: [
      {
        label: '225 ILCS 605/2, definitions, including the pet shop exclusion for animals you raised',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K2',
      },
      {
        label: '225 ILCS 605/2.2, records of origin and sale, and proof of pedigree',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K2%2E2',
      },
      {
        label: '225 ILCS 605/3.1, the disclosure list this guide uses as a template',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K3%2E1',
      },
      {
        label: '225 ILCS 605/3.15, the pet shop remedies that do not reach a private sale',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=022506050K3%2E15',
      },
    ],
  },
  {
    slug: 'choosing-a-trainer',
    title: 'Choosing a trainer, and what the letters mean',
    summary:
      'Dog training is an unregulated trade. Here is what the common certifications actually require, and what the veterinary profession says about method.',
    readingMinutes: 3,
    notice: 'vet',
    sections: [
      {
        heading: 'Anyone can use the title',
        body: [
          'No license is required to train dogs for a living. Certification is voluntary, which is exactly why it is worth asking about: each one tells you something specific about what its holder has been tested on.',
        ],
      },
      {
        heading: 'What the certifications require',
        body: [
          'CPDT-KA, from the Certification Council for Professional Dog Trainers, requires at least 300 hours of dog training experience in the previous three years, at least 225 of them teaching, an attestation signed by a certificant or a veterinarian, and a 200 question exam covering learning theory, instruction, canine behaviour and welfare, and professional ethics. Holders sign the council\u2019s code of ethics and its least intrusive, minimally aversive policy, and recertify every three years through continuing education. CBCC-KA is the same council\u2019s behaviour consultant credential.',
          'The International Association of Animal Behavior Consultants accredits trainers with at least two years of experience, and certifies behaviour consultants with three or more years working complex behaviour cases.',
          'Other certificates are issued by the school that taught the course. That is not a criticism, but the school set the syllabus and marked the exam, so ask what it required.',
        ],
      },
      {
        heading: 'The method question',
        body: [
          'The American Veterinary Society of Animal Behavior recommends that only reward-based methods be used for all dog training, including the treatment of behaviour problems.',
          'It names what it means by aversive: electronic and shock collars, prong collars, choke chains, leash corrections, citronella collars, physical punishment and shouting. The documented risks it attributes to them are fear, anxiety, stress, aggression, stress-related illness, pessimism, and a worse relationship between dog and owner. It also states there is no evidence that aversive methods work better.',
          'This is the one place where a strong opinion is not ours. It is the position of the veterinary specialty that studies the subject.',
        ],
      },
      {
        heading: 'Five questions before you book',
        body: [
          'What happens when my dog gets it right? What happens when my dog gets it wrong? What equipment will you put on my dog? May I watch a class before I enrol? What are you certified in, and when did you last recertify?',
          'The second question separates trainers. A clear answer involving food, a toy, or a pause is a good sign. Vagueness about "corrections" is also an answer.',
        ],
      },
      {
        heading: 'What should make you keep looking',
        body: [
          'A guarantee of results. Talk of being the alpha or of dominance, which has its own veterinary position statement saying it misreads what dogs do. Refusing to let you watch. Refusing to name the equipment. Telling you to disregard your veterinarian.',
        ],
      },
      {
        heading: 'Puppies: start earlier than feels safe',
        body: [
          'The window that matters most is roughly the first three months, when a puppy is more curious than fearful. AVSAB\u2019s position is that socialisation should begin before the vaccine series is complete, and its argument is blunt: behaviour problems, not infectious disease, are the leading cause of death in dogs under three years old.',
          'In practice classes start around seven or eight weeks, after a first set of vaccines and a first deworming, held somewhere cleaned between groups. Ask your veterinarian what applies to your puppy, and ask the class what it requires before the first session.',
        ],
      },
    ],
    sources: [
      {
        label: 'AVSAB, Humane Dog Training position statement (2021)',
        url: 'https://avsab.org/wp-content/uploads/2024/12/AVSAB-Humane-Dog-Training-Position-Statement-2021.pdf',
      },
      {
        label: 'AVSAB, what reward-based training means and which methods count as aversive',
        url: 'https://avsab.org/what-are-reward-based-training-methods-for-dogs-and-cats/',
      },
      {
        label: 'AVSAB, Puppy Socialization position statement',
        url: 'https://avsab.org/wp-content/uploads/2024/12/Puppy-Socialization-Position-Statement-FINAL.pdf',
      },
      {
        label: 'AVSAB, Dominance position statement',
        url: 'https://avsab.org/wp-content/uploads/2024/12/Dominance_Position_Statement-download.pdf',
      },
      {
        label: 'CCPDT, dog trainer certification requirements',
        url: 'https://www.ccpdt.org/certification/dog-trainer-certification/',
      },
      {
        label: 'IAABC, credentials and the experience each requires',
        url: 'https://iaabc.org/en/credentials',
      },
    ],
  },
  {
    slug: 'behaviour-help',
    title: 'When a trainer is not the right call',
    summary:
      'Aggression, sudden change and real fear belong to a different tier of professional. Who is qualified, and why the vet comes first.',
    readingMinutes: 3,
    notice: 'vet',
    sections: [
      {
        heading: 'If something changed, start at the vet',
        body: [
          'Pain and illness arrive dressed as behaviour. A dog that snaps when lifted, stops taking the stairs, wakes at three in the morning, or becomes a different animal inside a fortnight is telling you something that a training plan cannot answer.',
          'Rule out the body first. That is not advice about your dog, it is the order the professionals themselves work in.',
        ],
      },
      {
        heading: 'The tiers, and what each has actually done',
        body: [
          'A certified trainer teaches skills and handles the common problems: pulling, recall, jumping, house training, a dog that is rude rather than frightened.',
          'A behaviour consultant works the complex cases. The IAABC certifies dog behaviour consultants with three or more years on such cases, and the CCPDT certifies behaviour consultants through a separate exam from its trainer one.',
          'A certified applied animal behaviorist comes through academia. The Animal Behavior Society requires a master\u2019s degree with a research thesis and two years of professional experience for its associate level, and, for full certification, either a doctorate with five years of professional experience or a veterinary degree with an approved residency and three years of it, alongside thirty semester credits of behavioural science and references from the field.',
          'A veterinary behaviorist is a licensed veterinarian who completed a multi-year residency in behaviour after an internship year, carried a supervised caseload, published case reports and research, and passed the specialty board examination. Because they are veterinarians, they can investigate medical contributors and prescribe medication. Nobody else on this list can.',
        ],
      },
      {
        heading: 'What a behaviour consultation actually is',
        body: [
          'A history first, often long: what the dog does, where, how often, what happened the first time, what you have already tried. Video of the behaviour in its real setting is worth more than any description of it.',
          'Then a management plan before a training plan, because the first job is to stop the dog rehearsing the behaviour. Expect something in writing, and expect follow-up. It is a course of work, not an appointment.',
        ],
      },
      {
        heading: 'The cases that should not wait',
        body: [
          'A bite, or a bite attempted. Sudden panic. Self-injury. Fear that stops a dog eating or sleeping. Aggression around a baby, a visitor, or another animal in the house.',
          'Book the veterinarian, ask for a referral to a veterinary behaviorist if one is reachable, and in the meantime manage with distance, barriers and fewer demands rather than correction.',
        ],
      },
      {
        heading: 'What we do not do',
        body: [
          'Forming Paws does not train dogs, does not employ behaviour professionals, and does not verify anyone\u2019s credentials. We are not a referral service and nobody pays to be mentioned here.',
          'Ask a professional for their certification directly, then look them up in the certifying body\u2019s own directory. Every organisation named on this page publishes one.',
        ],
      },
    ],
    sources: [
      {
        label: 'Animal Behavior Society, CAAB and ACAAB certification requirements',
        url: 'https://www.animalbehaviorsociety.org/web/committees-applied-behavior-caab.php',
      },
      {
        label: 'IAABC, credentials and the experience each requires',
        url: 'https://iaabc.org/en/credentials',
      },
      {
        label: 'CCPDT, certifications for trainers and behaviour consultants',
        url: 'https://www.ccpdt.org/certification/',
      },
      {
        label: 'American College of Veterinary Behaviorists, certification and directory',
        url: 'https://www.dacvb.org/',
      },
    ],
  },
  {
    slug: 'year-round-wellness',
    title: 'A year of ordinary care',
    summary:
      'What routine care covers between appointments: the exam everything hangs off, the vaccination the law requires, parasite schedules, and what to write down.',
    readingMinutes: 3,
    notice: 'vet',
    sections: [
      {
        heading: 'The shape of a year, not the medicine',
        body: [
          'This page describes what routine care usually covers, so that you know what to ask about and what to keep. It does not tell you what your dog needs. Your veterinarian decides that, and a dog with a diagnosed condition follows their plan rather than any checklist.',
        ],
      },
      {
        heading: 'The appointment everything else hangs off',
        body: [
          'Veterinary guidance puts a healthy adult dog at a wellness examination at least once a year. Puppies are seen repeatedly through their first months, and older dogs more often than adults, because things change faster at both ends of a life.',
          'Verification here asks for a veterinary wellness exam dated within the last twelve months. Treat that as a floor rather than a schedule. Book the next appointment before you leave the current one, which is the only reliable way it happens.',
        ],
      },
      {
        heading: 'Vaccination, and the one the law requires',
        body: [
          'Rabies is not a preference. Illinois requires every dog four months or older to be inoculated by a licensed veterinarian, with a second dose within a year of the first and boosters thereafter set by the licensed duration of the vaccine used. Chicago will not issue a dog license without proof of a current one.',
          'Veterinarians treat some other vaccines as routine for nearly every dog, and choose the rest by where your dog goes and what it does. Boarding, daycare, grooming, hiking and fieldwork all change the answer, so describe your dog\u2019s actual life at the appointment.',
        ],
      },
      {
        heading: 'Parasites are a calendar, not an event',
        body: [
          'The Companion Animal Parasite Council recommends year-round broad-spectrum control covering heartworm, intestinal parasites, fleas and ticks, and annual heartworm testing.',
          'It recommends testing a stool sample at least four times during the first year of life and at least twice a year afterwards, adjusted for lifestyle, and deworming puppies from two weeks of age, repeated every two weeks until regular control begins.',
          'Several of these parasites can infect people. Picking up the yard daily and washing hands afterwards is part of the protocol, not fastidiousness, and it matters most in households with young children.',
        ],
      },
      {
        heading: 'What to watch between visits',
        body: [
          'Weight and body condition, appetite and thirst, energy, teeth and breath, limping, lumps, itching, and any change in behaviour. A dog that hides, guards a spot, or stops greeting you is reporting something.',
          'Write down the date a change started. The difference between "he has been off lately" and "this started on the 9th, after the boarding kennel" is the difference between a shrug and a diagnosis.',
        ],
      },
      {
        heading: 'Keep the paperwork where you can find it',
        body: [
          'Exam summaries and vaccination history are what verification reads, what a boarding kennel wants, and what a new veterinarian needs if you move. Ask for them as separate documents, which makes every one of those requests faster.',
        ],
      },
    ],
    sources: [
      {
        label: '510 ILCS 5/8, rabies inoculation requirements in Illinois',
        url: 'https://www.ilga.gov/legislation/ilcs/fulltext?DocName=051000050K8',
      },
      {
        label: 'Companion Animal Parasite Council, general guidelines for dogs and cats',
        url: 'https://capcvet.org/guidelines/general-guidelines/',
      },
      {
        label: 'Chicago City Clerk, dog registration and its rabies requirement',
        url: 'https://www.chicityclerk.com/dog-registration',
      },
    ],
  },
]

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
