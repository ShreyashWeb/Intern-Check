/**
 * Hard rules for V1 of InternCheck.
 * Each rule defines a pattern, score deduction, category, standard description, and simplified explanation.
 */
export const rules = [
  {
    id: "registration_fee",
    name: "Application or Registration Fee Required",
    category: "Financial Requirement",
    tier: "hard-block",
    regex: /(registration fee|processing fee|application fee|pay to apply|pay rs\.?\s*\d+|pay rupees\s*\d+|enrollment fee)/i,
    deduction: 40,
    explanation: "The listing mentions charging an upfront registration or processing fee to apply. Legitimate internships will never charge you to apply or work.",
    simplified: "🚩 Warning: This company is asking you to pay money just to apply or register. Real internships pay you, not the other way around! Do not pay them anything."
  },
  {
    id: "training_bundle",
    name: "Mandatory Paid Training or Course Purchase",
    category: "Financial Requirement",
    tier: "hard-block",
    regex: /(pay to confirm|guaranteed placement|training fee|buy.*course|mandatory purchase|course bundle|placement fee|purchase.*certification)/i,
    deduction: 40,
    explanation: "This listing requires purchasing a training program, course, or certificate bundle as a condition of recruitment or to 'guarantee' a job. This is a common scam layout designed to sell courses.",
    simplified: "🚩 Warning: They want you to buy their training course or certification before you can start or to 'guarantee' you a spot. This is usually a course-selling trick, not a real internship."
  },
  {
    id: "security_deposit",
    name: "Security Deposit / Refundable Guarantee",
    category: "Financial Requirement",
    tier: "hard-block",
    regex: /(security deposit|refundable deposit|refundable guarantee|deposit rs|deposit rupees|deposit fee)/i,
    deduction: 45,
    explanation: "The description asks for a security deposit or a 'refundable check-in' fee to secure the laptop, materials, or position. Scammers use this to steal money and disappear.",
    simplified: "🚨 Red Alert: They are asking for a 'refundable' security deposit or caution money. Once you pay this, scammers almost always vanish with your money. Never pay a deposit."
  },
  {
    id: "unpaid_commercial",
    name: "Exploitative Unpaid Work",
    category: "Compensation",
    tier: "soft-signal",
    regex: /(unpaid|no stipend|free work|volunteer for commercial|commission only|without pay|no pay)/i,
    deduction: 20,
    explanation: "The role is unpaid or commission-only for a commercial business. Under many labor guidelines, internships at for-profit companies must offer at least minimum compensation or clear educational credits.",
    simplified: "⚠️ Caution: This role offers no pay or is commission-only. Working for free at a for-profit business is often unfair or illegal. Make sure you get real value or college credits!"
  },
  {
    id: "suspicious_chat",
    name: "Suspicious Communication / Chat Recruitment",
    category: "Communication",
    tier: "soft-signal",
    regex: /(whatsapp group|telegram group|dm me on|contact on whatsapp|contact on telegram|direct message.*telegram|reach out.*telegram)/i,
    deduction: 30,
    explanation: "Recruitment activities are directed exclusively through informal messaging platforms like Telegram or WhatsApp groups instead of official corporate emails or portals.",
    simplified: "🚩 Warning: They are directing you to a WhatsApp or Telegram group to apply or communicate. Real companies use official email addresses (like name@company.com) or official websites, not chat groups."
  },
  {
    id: "unrealistic_earnings",
    name: "Unrealistic Earnings / Get Rich Quick Claims",
    category: "Compensation",
    tier: "soft-signal",
    regex: /(earn 1 lakh|make \$?\d{4,}\/week|quick rich|unlimited earning|guaranteed income|earn from home.*lakh)/i,
    deduction: 30,
    explanation: "The description boasts unrealistic, highly inflated payouts for minimal effort or basic work (e.g., data entry, form filling). This is a common front for financial scams.",
    simplified: "🚩 Warning: The pay looks too good to be true (e.g. making huge sums of money with very little work). If it sounds too good to be true, it almost certainly is."
  },
  {
    id: "mlm_recruitment",
    name: "Multi-Level Marketing (MLM) or Referral System",
    category: "Business Model",
    tier: "soft-signal",
    regex: /(recruit 3 people|network marketing|referral system to earn|mlm|recruit others|bring.*people|downline)/i,
    deduction: 35,
    explanation: "The internship involves recruiting other people or selling memberships/services to your own network to earn points or stipend. This is a pyramid or MLM scheme, not a professional internship.",
    simplified: "🚨 Red Alert: This is a pyramid scheme where your job is to recruit other students or sell products to your friends. A real internship helps you build skills, not recruit a 'downline'."
  }
];
