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

export type Guide = {
  slug: string
  title: string
  summary: string
  readingMinutes: number
  sections: { heading: string; body: string[] }[]
}

export const GUIDES: Guide[] = [
  {
    slug: 'health-documents',
    title: 'What health documents you need, and why',
    summary:
      'The paperwork that unlocks matching, where to get it, and what our reviewers actually look at.',
    readingMinutes: 4,
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
    readingMinutes: 3,
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
    readingMinutes: 3,
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
]

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
