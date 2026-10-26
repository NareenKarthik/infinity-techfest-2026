/**
 * Hackathon Portal Data Store
 * Contains Problem Statements, General Rules, Users/Teams mapping, and Initial Settings
 */

const HACKATHON_CONFIG = {
  eventName: "SHRISTI 2026 : RAPID PROTOTYPING HACKATHON",
  domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
  durationMinutes: 150,
  eventType: "Rapid Prototyping Hackathon",
  submissionRequirement: "Working Prototype with a Brief Explanation",
  defaultWebhookUrl: ""
};

const GENERAL_RULES = [
  {
    id: 1,
    title: "Prototype Delivery Within Allotted Time",
    rule: "Teams must submit a working prototype within the allotted time."
  },
  {
    id: 2,
    title: "Permitted AI and Tool Usage",
    rule: "Participants may use AI coding assistants, open-source libraries, and permitted APIs."
  },
  {
    id: 3,
    title: "Transparency on Implemented vs Simulated",
    rule: "Teams must clearly explain which features are implemented and which are simulated."
  },
  {
    id: 4,
    title: "Core Functionality Demonstration",
    rule: "The prototype must demonstrate the core functionality of the selected problem statement."
  },
  {
    id: 5,
    title: "No Faked Live Detections",
    rule: "Participants must not present sample or simulated results as genuine live detections."
  },
  {
    id: 6,
    title: "Attribution and Citation",
    rule: "All datasets, APIs, and external resources used must be acknowledged."
  },
  {
    id: 7,
    title: "Legal, Privacy and Consent Compliance",
    rule: "Teams must respect privacy, consent, copyright, and applicable laws."
  },
  {
    id: 8,
    title: "Restricted Sensitive Data",
    rule: "Participants must not upload private or sensitive recordings without proper permission."
  },
  {
    id: 9,
    title: "Uncertainty & Responsible Claims",
    rule: "Detection systems must communicate uncertainty and must not make unsupported claims."
  },
  {
    id: 10,
    title: "Live Demonstration & Evaluation",
    rule: "Judges may evaluate the prototype through a live demonstration and questions."
  }
];

const PROBLEM_STATEMENTS = [
  {
    id: 1,
    number: "01",
    title: "AI-POWERED SHORT VIDEO GENERATOR",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Generative AI & Multimedia",
    icon: "video",
    description: "Develop a prototype that converts a text prompt into a short video or video storyboard with relevant scenes, captions, and optional narration.",
    features: [
      "Accept a topic/text prompt.",
      "Generate script/storyboard.",
      "Divide into scenes.",
      "Add images/captions/transitions.",
      "Provide narration options.",
      "Preview and export."
    ],
    suggestedTech: ["Python", "Streamlit", "MoviePy", "FFmpeg", "AI APIs"]
  },
  {
    id: 2,
    number: "02",
    title: "AI-GENERATED VIDEO AND DEEPFAKE DETECTOR",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Cybersecurity & Media Forensics",
    icon: "shield-alert",
    description: "Develop a prototype that examines an uploaded video and identifies possible signs of manipulation or AI generation.",
    features: [
      "Allow video upload.",
      "Extract frames.",
      "Analyze frames using pretrained models.",
      "Display manipulation-risk score.",
      "Highlight suspicious frames.",
      "Explain the result."
    ],
    suggestedTech: ["Python", "OpenCV", "Streamlit", "deepfake-detection models"]
  },
  {
    id: 3,
    number: "03",
    title: "FAKE IMAGE AND AI-GENERATED IMAGE DETECTOR",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Cybersecurity & Computer Vision",
    icon: "image",
    description: "Build a system that analyzes an uploaded image and reports indicators that may suggest AI generation or manipulation.",
    features: [
      "Upload image.",
      "Display metadata.",
      "Analyze using forensic techniques.",
      "Identify visual indicators.",
      "Present classification.",
      "Explain limitations."
    ],
    suggestedTech: ["Python", "OpenCV", "Pillow", "Streamlit", "image-classification models"]
  },
  {
    id: 4,
    number: "04",
    title: "AI-GENERATED VOICE AND VOICE CLONE DETECTOR",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Audio Forensics & Security",
    icon: "mic",
    description: "Develop a prototype that analyzes an uploaded audio clip and estimates whether it may contain synthetic or manipulated speech.",
    features: [
      "Upload audio.",
      "Display duration/playback controls.",
      "Extract audio features.",
      "Estimate if natural/synthetic.",
      "Display confidence.",
      "Provide explanation."
    ],
    suggestedTech: ["Python", "Librosa", "NumPy", "Streamlit", "audio-classification models"]
  },
  {
    id: 5,
    number: "05",
    title: "SPEECH-TO-TEXT SCAM AND MANIPULATION ANALYZER",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "NLP & Fraud Detection",
    icon: "phone-call",
    description: "Develop a system that converts speech into text and analyzes the transcript for potential scam indicators.",
    features: [
      "Accept audio recording.",
      "Convert to text.",
      "Identify suspicious phrases.",
      "Highlight indicators (urgent demands).",
      "Generate risk summary.",
      "Suggest safe next steps."
    ],
    suggestedTech: ["Python", "speech-recognition", "NLP tools", "Streamlit"]
  },
  {
    id: 6,
    number: "06",
    title: "AI MEDIA VERIFICATION AND PROVENANCE CHECKER",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Metadata & Provenance",
    icon: "file-check",
    description: "Build a tool that checks available metadata and supported provenance information to assess the traceability of a media file.",
    features: [
      "Upload media.",
      "Extract metadata.",
      "Check for content credentials.",
      "Display present/missing info.",
      "Generate verification report.",
      "Explain findings."
    ],
    suggestedTech: ["Python", "Pillow", "OpenCV", "ExifTool"]
  },
  {
    id: 7,
    number: "07",
    title: "LIP-SYNC MISMATCH DETECTOR",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Multimodal AI & Forensics",
    icon: "film",
    description: "Develop a prototype that examines a short video and identifies possible inconsistencies between visible speech movements and audio.",
    features: [
      "Upload video.",
      "Extract audio and frames.",
      "Analyze mouth movements vs audio timing.",
      "Identify timing mismatches.",
      "Display observations.",
      "Generate report."
    ],
    suggestedTech: ["Python", "OpenCV", "audio-processing libraries", "lip-sync models"]
  },
  {
    id: 8,
    number: "08",
    title: "AI VOICE COMMAND AND MEETING SUMMARIZER",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Productivity & Speech AI",
    icon: "list-todo",
    description: "Develop a tool that converts speech into text and automatically summarizes content into key points and actionable tasks.",
    features: [
      "Accept audio.",
      "Convert to text.",
      "Generate summary.",
      "Extract action items.",
      "Identify deadlines.",
      "Present in an organized dashboard."
    ],
    suggestedTech: ["Python", "speech-recognition", "NLP libraries", "Streamlit"]
  },
  {
    id: 9,
    number: "09",
    title: "SMARTCAMPUS AI – ACADEMIC RISK PREDICTION",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Predictive Analytics & EdTech",
    icon: "graduation-cap",
    description: "Develop an AI system that analyzes sample academic data and identifies students who may benefit from early academic support.",
    features: [
      "Upload sample student data.",
      "Analyze data.",
      "Classify risk (Low, Moderate, High).",
      "Display contributing factors.",
      "Recommend interventions.",
      "Provide overall trends dashboard."
    ],
    suggestedTech: ["Python", "Pandas", "Scikit-learn", "Streamlit", "SQLite"]
  },
  {
    id: 10,
    number: "10",
    title: "BIOSIGNALGUARD – VITAL-SIGN ANOMALY DETECTION",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Bio-Signals & Anomaly Detection",
    icon: "heart-pulse",
    description: "Develop a prototype that analyzes sample wearable data and identifies readings that deviate from expected patterns.",
    features: [
      "Accept sample CSV data.",
      "Display measurements.",
      "Establish reference ranges.",
      "Detect unusual readings.",
      "Display alerts.",
      "Explain flagged readings."
    ],
    suggestedTech: ["Python", "Pandas", "NumPy", "Scikit-learn", "Streamlit"]
  },
  {
    id: 11,
    number: "11",
    title: "EDUTRUST AI – SOURCE-GROUNDED ACADEMIC ASSISTANT",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "RAG & LLM Information Retrieval",
    icon: "book-open",
    description: "Develop an academic assistant that answers questions using supplied study materials and identifies sources supporting its answers.",
    features: [
      "Upload academic documents.",
      "Extract text.",
      "Accept questions.",
      "Retrieve relevant passages.",
      "Display answers with citations.",
      "State if info is insufficient."
    ],
    suggestedTech: ["Python", "Streamlit", "vector database", "embeddings", "LLM API"]
  },
  {
    id: 12,
    number: "12",
    title: "BIOCARE AI – PATIENT EDUCATION ASSISTANT",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Health Literacy & Intelligent Systems",
    icon: "cross",
    description: "Develop an AI assistant that explains general biomedical info in simple language using a trusted collection of educational resources.",
    features: [
      "Provide verified educational documents.",
      "Allow health questions.",
      "Retrieve relevant info.",
      "Explain terminology simply.",
      "Provide source references.",
      "Direct users to professionals for diagnoses."
    ],
    suggestedTech: ["Python", "Streamlit", "NLP", "LLM API"]
  },
  {
    id: 13,
    number: "13",
    title: "BIOMEDICAL PATIENT MONITORING & RESOURCE INTELLIGENCE",
    domain: "AI, Multimedia, Cybersecurity and Intelligent Applications",
    tag: "Healthcare Operations & Dashboard",
    icon: "activity",
    description: "Develop a prototype that combines sample patient-monitoring data with a resource dashboard to support operational decisions.",
    features: [
      "Accept synthetic hospital data.",
      "Display observations over time.",
      "Flag abnormal readings.",
      "Display resource availability.",
      "Provide alert dashboard.",
      "Generate operational suggestions."
    ],
    suggestedTech: ["Python", "Pandas", "Streamlit", "SQLite"]
  }
];

// Administrator Accounts for Hackathon Control
const PRELOADED_USERS = [
  { username: "Nareen Karthik", password: "Nareen@06", fullName: "Nareen Karthik", teamName: "Admin Operations", role: "SuperAdmin" },
  { username: "nareen", password: "Nareen@06", fullName: "Nareen Karthik", teamName: "Admin Operations", role: "SuperAdmin" },
  { username: "admin", password: "admin@shristi2026", fullName: "Hackathon Administrator", teamName: "Admin Operations", role: "SuperAdmin" },
  { username: "admin", password: "admin@innovex2026", fullName: "Hackathon Administrator", teamName: "Admin Operations", role: "SuperAdmin" }
];

