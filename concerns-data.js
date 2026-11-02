export const MAX_CONCERN_TITLE_LENGTH = 120;
export const MAX_CONCERN_DESCRIPTION_LENGTH = 2000;
export const MAX_INTERNAL_NOTE_LENGTH = 2000;

export const BEHAVIOR_ISSUES = [
  {
    id: "classroom-misconduct",
    level: 1,
    title: "Classroom misconduct",
    description: "Off-task behavior, disrupting instruction, horseplay, or other behaviors that interfere with learning."
  },
  {
    id: "campus-misconduct",
    level: 1,
    title: "Campus misconduct",
    description: "Inappropriate behavior outside the classroom, including hallway disruptions, cafeteria misconduct, or inappropriate public displays of affection."
  },
  {
    id: "dishonesty",
    level: 1,
    title: "Dishonesty",
    description: "Academic dishonesty, plagiarism, cheating, submitting another person's work, or providing false information."
  },
  {
    id: "electronic-device-misuse",
    level: 1,
    title: "Inappropriate use of electronic devices",
    description: "Using personal electronic devices without permission or in a manner that disrupts learning."
  },
  {
    id: "insubordination",
    level: 1,
    title: "Insubordination",
    description: "Refusing reasonable teacher directions, failing to complete assigned work, or refusing to follow classroom expectations."
  },
  {
    id: "tardiness",
    level: 1,
    title: "Tardiness",
    description: "Repeated unexcused lateness to class."
  },
  {
    id: "inappropriate-dress",
    level: 1,
    title: "Inappropriate dress",
    description: "Violations of the school's dress code."
  },
  {
    id: "school-misrepresentation",
    level: 1,
    title: "Misrepresentation of the school",
    description: "Behavior that reflects negatively on HCAS while representing the school on or off campus."
  },
  {
    id: "abusive-language-gestures",
    level: 1,
    title: "Abusive or intimidating language/gestures",
    description: "Threatening, harassing, or inappropriate language or gestures directed toward another student."
  },
  {
    id: "acceptable-use-policy",
    level: 1,
    title: "Violation of the school's acceptable use policy",
    description: "Misuse of school technology or computer systems."
  },
  {
    id: "altering-school-records",
    level: 2,
    title: "Altering school records",
    description: "Falsifying attendance, grades, or other official school records."
  },
  {
    id: "bullying-intimidation",
    level: 2,
    title: "Bullying or intimidation",
    description: "In-person or digital bullying, threatening, or intimidating behavior."
  },
  {
    id: "continued-level-one",
    level: 2,
    title: "Continued Level I misconduct",
    description: "Repeated documented Level I infractions that demonstrate ongoing disregard for school expectations."
  },
  {
    id: "property-damage",
    level: 2,
    title: "Destruction or defacing of school property",
    description: "Intentional damage to school or personal property."
  },
  {
    id: "fighting",
    level: 2,
    title: "Fighting",
    description: "Physical altercations between students."
  },
  {
    id: "harassment",
    level: 2,
    title: "Harassment",
    description: "Persistent behaviors intended to embarrass, intimidate, or torment another student."
  },
  {
    id: "harassment-of-staff",
    level: 2,
    title: "Harassment of staff",
    description: "Threatening, abusive, or intimidating behavior directed toward school employees."
  },
  {
    id: "serious-insubordination",
    level: 2,
    title: "Serious insubordination",
    description: "Persistent or willful refusal to comply with school expectations."
  },
  {
    id: "prohibited-items",
    level: 2,
    title: "Possession of prohibited items",
    description: "Weapons, alcohol, illegal drugs, tobacco/vaping products, fireworks, or other prohibited or illegal items."
  },
  {
    id: "refusal-disciplinary-consequences",
    level: 2,
    title: "Refusal to complete disciplinary consequences",
    description: "Refusal to complete an assigned disciplinary consequence."
  },
  {
    id: "school-bus-misconduct",
    level: 2,
    title: "School bus misconduct",
    description: "Misconduct while using school transportation."
  },
  {
    id: "theft",
    level: 2,
    title: "Theft",
    description: "Taking property without authorization."
  },
  {
    id: "unauthorized-leaving-campus",
    level: 2,
    title: "Unauthorized leaving of campus",
    description: "Leaving campus without authorization."
  },
  {
    id: "truancy-unexcused-absences",
    level: 2,
    title: "Truancy or repeated unexcused absences",
    description: "Truancy or a pattern of repeated unexcused absences."
  }
];

export const LEVEL_ONE_ACTIONS = {
  1: {
    label: "First occurrence",
    description: "Teacher conference and reteaching of expectations. Document the behavior through the Level I referral form and submit it to the Dean of Students."
  },
  2: {
    label: "Second occurrence",
    description: "Contact the parents and copy the Dean of Students on the communication."
  },
  3: {
    label: "Third occurrence or repeated pattern",
    description: "Elevate the behavior to a Level II Referral and refer it to the Dean of Students for administrative intervention."
  }
};

export const LEVEL_TWO_ACTION = {
  label: "Immediate administrative referral",
  description: "Refer the student immediately to Parent Services to meet with the Dean of Students and/or Assistant Principal or Principal. Complete a Level II referral form, provide it to Parent Services, notify parents, and allow Administration to investigate the incident."
};

export const BEHAVIOR_STRATEGY_GROUPS = [
  {
    id: "tier-1-instructional",
    label: "Tier 1 instructional strategies",
    options: [
      "Communicate clear learning objectives",
      "Use direct instruction followed by guided, collaborative, and independent practice",
      "Maintain a structured, concise pace",
      "Use explicit signals and routines for transitions",
      "State expectations for group and individual work",
      "Repeat or rephrase important directions",
      "Write step-by-step instructions on the board",
      "Activate prior knowledge",
      "Provide important concepts or terms on a graphic organizer",
      "Present content in small, sequential chunks",
      "Model thinking aloud",
      "Use clear, concise language",
      "Create visible anchor charts",
      "Use pictures, symbols, or non-linguistic vocabulary representations",
      "Provide graphic organizers or notes to scaffold retelling",
      "Preview content using pictures, video, or charts",
      "Circulate to clarify and prompt task initiation",
      "Use frequent formative assessment and checks for understanding",
      "Provide sentence starters, word banks, or partially completed organizers",
      "Provide a one-on-one mini-lesson",
      "Offer extension tasks for early finishers",
      "Pre-teach critical academic vocabulary",
      "Pair new vocabulary with movement or visuals",
      "Require and scaffold complete academic-language responses"
    ]
  },
  {
    id: "tier-1-behavioral",
    label: "Tier 1 behavioral strategies",
    options: [
      "Clearly define and post positive rules",
      "Point out students who are following the rules",
      "Give specific reminders when rules are not followed",
      "Use verbal praise tied to expectations",
      "Teach clear classroom procedures",
      "Define expectations for audience members, presenters, lectures, group work, individual work, and tests",
      "Model and role-play expected behavior",
      "Provide practice opportunities with feedback",
      "Reteach expectations after breaks or when issues arise",
      "Redirect off-task behavior",
      "Adjust the seating chart",
      "Use proximity control",
      "Use active supervision and immediate feedback"
    ]
  },
  {
    id: "tier-1-sel",
    label: "Tier 1 SEL strategies",
    options: [
      "Greet the student by name at the door",
      "Use the 2x10 relationship-building strategy",
      "Use an interest survey or student inventory",
      "Send a positive note, call, or email home",
      "Provide a one-on-one check-in",
      "Offer student jobs or leadership roles",
      "Use visual schedules and daily agendas",
      "Give advance warning before transitions",
      "Provide a calm corner or quiet space",
      "Use feelings check-ins",
      "Use Zones of Regulation, mood meters, or feelings charts",
      "Teach the student to name and label emotions",
      "Practice breathing, grounding, or stretching",
      "Provide movement or brain breaks",
      "Use journaling, drawing, or reflection time",
      "Teach I-statements and active listening",
      "Practice posted problem-solving steps",
      "Use restorative conversations",
      "Use class circles or morning meetings",
      "Create class agreements with students",
      "Offer student voice and choice",
      "Teach collaborative norms and team building",
      "Use specific, descriptive praise",
      "Use class-wide recognition systems",
      "Offer choices within tasks",
      "Use pre-corrections and prompts",
      "Provide visual reminders or cue cards",
      "Use a trusted-adult check-in/check-out",
      "Offer flexible seating",
      "Avoid power struggles and offer choices",
      "Teach self-regulation before a crisis"
    ]
  },
  {
    id: "tier-2-behavioral",
    label: "Tier 2 behavioral interventions",
    options: [
      "Daily check-in/check-out with an assigned staff member",
      "Record behavior against two or three measurable goals",
      "Create a written behavior agreement",
      "Provide small-group social skills sessions",
      "Provide structured conflict-resolution sessions",
      "Teach recognition of emotional triggers and frustration management",
      "Schedule regular meetings with a teacher, counselor, or Dean",
      "Use guided restorative discussions",
      "Use student self-assessment and reflection questions",
      "Provide planned short breaks with clear return procedures",
      "Use a targeted positive reinforcement system",
      "Provide short sessions focused on one specific behavior",
      "Schedule school-home updates",
      "Provide friendship and boundary coaching",
      "Teach problem identification, consequences, and decision making",
      "Add transition routines, reminders, and supervision",
      "Provide adult support during high-risk times",
      "Schedule guided reflection on triggers and alternative behaviors",
      "Teach anger-trigger awareness and coping strategies",
      "Complete a structured review of when, where, and why behavior occurs"
    ]
  },
  {
    id: "tier-2-sel",
    label: "Tier 2 SEL interventions",
    options: [
      "Provide a planned check-in linked to a coping or participation goal",
      "Practice the agreed coping or help-seeking strategy before a challenge",
      "Agree on a discreet signal for help or a break",
      "Provide a brief break and support the return to learning",
      "Preview changes or situations that may cause stress",
      "Practice respectful communication after peer conflicts",
      "Recognize help-seeking, emotional regulation, and return to activities"
    ]
  },
  {
    id: "tier-3-behavioral",
    label: "Tier 3 behavioral interventions",
    options: [
      "Develop an individualized behavior intervention plan",
      "Complete a Functional Behavior Assessment",
      "Schedule daily one-to-one staff meetings",
      "Provide intensive individual counseling",
      "Use an individualized behavior tracking system",
      "Create an individualized behavior contract",
      "Teach and practice replacement behaviors",
      "Provide intensive anger-management support",
      "Provide individualized social-skills training",
      "Add structured support during high-risk situations",
      "Develop personalized de-escalation strategies",
      "Create an individualized safety or crisis response plan",
      "Hold regular student, parent, teacher, counselor, and administrator meetings",
      "Provide intensive mentoring and frequent feedback",
      "Use an individualized self-regulation program",
      "Create a structured reintegration plan",
      "Provide targeted sessions for persistent aggression, contact, defiance, or peer conflict",
      "Coordinate with external behavioral or mental-health specialists",
      "Make individualized environmental adjustments",
      "Review behavioral data frequently with the Student Support Team"
    ]
  },
  {
    id: "tier-3-sel",
    label: "Tier 3 SEL interventions",
    options: [
      "Follow the individualized classroom support plan",
      "Continue helpful Tier 2 strategies with closer adult support",
      "Use agreed language, prompts, and responses across classes",
      "Break challenging activities into manageable steps and support return to learning",
      "Provide agreed adult support during difficult transitions",
      "Use the student's agreed distress-support procedures",
      "Monitor emotional state, participation, and response to support",
      "Record progress indicators and share updates with SST",
      "Report significant deterioration or new safety concerns promptly"
    ]
  }
];

export const TIER_ONE_INSTRUCTIONAL_STRATEGIES =
  BEHAVIOR_STRATEGY_GROUPS.find((group) => group.id === "tier-1-instructional").options;

export const TIER_TWO_ACADEMIC_INTERVENTIONS = [
  "Small-group or individual tutoring after school or during ECs",
  "Peer tutoring",
  "Alternative class setting for assignment completion",
  "Skills tutor",
  "Study-skills instruction",
  "Modified assignments",
  "Opportunity to redo work for a better grade",
  "Instruction broken into smaller parts",
  "Tests or assignments read aloud",
  "Frequent breaks",
  "Guided reading strategies",
  "Dictation to a teacher of what the student wrote or drew",
  "Oral or demonstration testing",
  "Change the test format",
  "Assign a project rather than a written report",
  "Additional time for tests and assignments",
  "Frequent teacher feedback",
  "Individual help from a teacher or other staff member",
  "Copy notes from the teacher or another student",
  "Change the work area",
  "Use a timer to keep on task",
  "Use cues to refocus attention"
];

export const ACADEMIC_CONCERN_EXAMPLES = {
  1: [
    "Scoring below benchmark in reading, math, or writing",
    "Low assessment scores",
    "Missing or incomplete assignments",
    "Poor homework completion",
    "Lack of organization",
    "Off-task behavior during instruction",
    "Difficulty with foundational skills",
    "Slow progress compared with peers",
    "Teacher observation of difficulty with grade-level content",
    "Attendance or tardiness affecting learning",
    "Lack of engagement",
    "Language or vocabulary barriers"
  ],
  2: [
    "Reading below grade-level benchmark",
    "Difficulty with decoding, fluency, comprehension, or vocabulary",
    "Writing difficulties",
    "Math difficulties",
    "Difficulty retaining or applying previously taught skills",
    "Low quiz or test scores across multiple assessments",
    "Missing or incomplete assignments despite Tier 1 supports",
    "Needs frequent reteaching or small-group support",
    "Difficulty following multi-step directions",
    "Difficulty completing independent work",
    "Avoidance or off-task behavior during academic tasks",
    "Lack of response to Tier 1 interventions",
    "Progress monitoring shows insufficient growth"
  ],
  3: [
    "Little or no growth after a full Tier 2 intervention cycle",
    "Performing well below grade level in reading, writing, or math",
    "Severe foundational deficits",
    "Unable to access grade-level curriculum with Tier 2 supports",
    "Flat or declining progress-monitoring growth",
    "Multiple data sources indicate intensive need",
    "High frustration, avoidance, or distress during academic tasks",
    "Possible disability suspicion",
    "Need for individualized, intensive intervention"
  ]
};

export const ACADEMIC_PROFILES = [
  {
    id: "dyslexia",
    name: "Reading Disorder / Dyslexia",
    strategies: [
      "Explicit, systematic decoding instruction",
      "Purposeful fluency building",
      "Explicit vocabulary and morphological instruction",
      "Teach comprehension routines explicitly",
      "Provide intensive, targeted practice with progress monitoring"
    ]
  },
  {
    id: "dysgraphia",
    name: "Written Expression Disorder / Dysgraphia",
    strategies: [
      "Explicit writing-strategy instruction",
      "Teach the writing process for authentic purposes",
      "Build transcription fluency",
      "Provide frequent, scaffolded writing with actionable feedback",
      "Use access tools without lowering the learning target"
    ]
  },
  {
    id: "dyscalculia",
    name: "Mathematics Disorder / Dyscalculia",
    strategies: [
      "Systematic, explicit mathematics instruction",
      "Teach mathematical language directly",
      "Use concrete and semi-concrete representations",
      "Use number lines strategically",
      "Teach word-problem structures explicitly"
    ]
  },
  {
    id: "adhd-executive-function",
    name: "ADHD / Executive-Function Learning Needs",
    strategies: [
      "Behavioral classroom management",
      "Organizational skills training",
      "Structure and chunk complex tasks",
      "Reduce avoidable distraction and adjust access conditions",
      "Teach self-monitoring with frequent feedback"
    ]
  },
  {
    id: "developmental-language",
    name: "Developmental Language / Communication Disorder",
    strategies: [
      "Explicitly teach high-value vocabulary",
      "Teach syntax and morphology in meaningful contexts",
      "Teach narrative and expository discourse",
      "Provide communication scaffolds and processing time",
      "Coordinate specialist work with classroom instruction"
    ]
  },
  {
    id: "autism-lower-support",
    name: "Autism With Lower Support Needs",
    strategies: [
      "Visual supports",
      "Social narratives",
      "Explicit social-skills instruction with practice and feedback",
      "Self-management",
      "Antecedent-based and structured supports"
    ]
  }
];
