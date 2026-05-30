import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  FileText,
  Flag,
  Gavel,
  Handshake,
  Search,
  Shield,
  ShieldCheck,
  Swords,
  Ticket,
  Wallet,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type DocId =
  | "terms"
  | "tournament-rules"
  | "privacy"
  | "community"
  | "refund-wallet"
  | "fair-play"
  | "creator-rules"
  | "moderation";

type DocBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "callout"; tone: "info" | "warn"; title: string; text: string };

type DocSection = {
  id: string;
  title: string;
  blocks: DocBlock[];
};

type LegalDoc = {
  id: DocId;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  lastUpdated: string;
  seoDescription: string;
  sections: DocSection[];
};

const LAST_UPDATED = "May 19, 2026";
const SUPPORT_EMAIL = "support@battle4arena.fun";

const toId = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const containsQuery = (text: string, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
};

const renderBlock = (block: DocBlock) => {
  if (block.type === "p") {
    return <p className="text-sm leading-6 text-muted-foreground">{block.text}</p>;
  }

  if (block.type === "ul") {
    return (
      <ul className="space-y-2 text-sm text-muted-foreground">
        {block.items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  const tone =
    block.tone === "warn"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-secondary/30 bg-secondary/10 text-secondary";

  return (
    <div className={cn("rounded-lg border p-3", tone)}>
      <p className="font-heading text-xs font-bold">{block.title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{block.text}</p>
    </div>
  );
};

const DOCS: LegalDoc[] = [
  {
    id: "terms",
    title: "Terms & Conditions",
    shortTitle: "Terms",
    icon: Gavel,
    description: "Your agreement with Battle4Arena for using the platform, tournaments, wallets, and community spaces.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Terms & Conditions covering accounts, tournaments, wallet usage, safety, fair play, moderation, and legal rights.",
    sections: [
      {
        id: "acceptance",
        title: "Acceptance Of These Terms",
        blocks: [
          {
            type: "p",
            text:
              "These Terms & Conditions (the \"Terms\") govern your access to and use of Battle4Arena, including our website, apps, tournament tools, wallet features, chat, and support systems (collectively, the \"Services\"). By accessing or using the Services, you agree to be bound by these Terms and our policies listed in the Legal Center.",
          },
          {
            type: "callout",
            tone: "info",
            title: "Not Legal Advice",
            text:
              "These Terms are written for real-world operations, but they are not legal advice. If you need legal guidance for your jurisdiction, consult a qualified lawyer.",
          },
        ],
      },
      {
        id: "eligibility",
        title: "Eligibility, Age, And Account Security",
        blocks: [
          {
            type: "ul",
            items: [
              "You must be at least 13 years old to use the Services. If you are under the age of majority in your jurisdiction, you must have permission from a parent/legal guardian.",
              "You must provide accurate account information and keep it updated, including your username and contact details used for OTP/login.",
              "You are responsible for protecting OTPs, passwords, recovery codes, and device access. Do not share OTPs or allow others to use your account.",
              "We may restrict or deny access if we reasonably believe you are using automation, fake identities, or trying to bypass safety, anti-fraud, or fair play controls.",
            ],
          },
        ],
      },
      {
        id: "tournaments",
        title: "Tournament Participation",
        blocks: [
          {
            type: "p",
            text:
              "Tournaments may be hosted by creators/organizers and administered with platform oversight. By joining a tournament, you agree to follow the tournament's published settings (entry fee, schedule, mode, slots, room rules, reporting requirements), as well as Battle4Arena platform policies.",
          },
          {
            type: "ul",
            items: [
              "Your registration is valid only after successful wallet deduction and confirmation in the app.",
              "Room ID/password sharing is controlled by creators/admins and should only be used by eligible participants.",
              "We may delay or withhold results/prize settlement to investigate suspicious activity, cheating reports, payment fraud, or disputes.",
              "We may cancel or reschedule tournaments due to technical failures, abuse, low participation, force majeure, or safety reasons.",
            ],
          },
        ],
      },
      {
        id: "wallet",
        title: "Wallet, Payments, And Refunds",
        blocks: [
          {
            type: "p",
            text:
              "The Battle4Arena wallet is used for entry fees, prizes, refunds, and transfers (where enabled). Deposits may be processed by third-party payment providers. We do not store full card data on our servers.",
          },
          {
            type: "ul",
            items: [
              "You must use your own payment instruments and must not use stolen, unauthorized, or fraudulent payment methods.",
              "Wallet balances are not a bank account. Withdrawals may be limited, delayed, or declined due to fraud checks, compliance obligations, disputes, or chargebacks.",
              "Refunds depend on the Refund & Wallet Policy. Some fees may be non-refundable once a tournament begins or when fraud risk exists.",
              "We may reverse wallet credits if a payment is reversed/charged back, a tournament result is voided, or a payout is determined to be illegitimate.",
            ],
          },
        ],
      },
      {
        id: "community",
        title: "User Conduct And Community Safety",
        blocks: [
          {
            type: "ul",
            items: [
              "No cheating, hacking, scripting, macro abuse, exploit abuse, spoofing, or unfair advantage in tournaments.",
              "No harassment, hate, threats, doxxing, sexual content involving minors, or targeted abuse in chat, profiles, or reports.",
              "No scams, phishing, fake giveaways, payment fraud, or impersonation of creators/admins/other players.",
              "No spam, disruptive advertising, or coordinated abuse (including mass reporting or brigading).",
              "Follow the Community Guidelines, Fair Play & Anti-Cheat Policy, and Reporting & Moderation Policy.",
            ],
          },
        ],
      },
      {
        id: "content",
        title: "User-Generated Content (UGC)",
        blocks: [
          {
            type: "p",
            text:
              "You may create content such as usernames, profile details, chat messages, match screenshots, video links, and reports (\"UGC\"). You retain ownership of your UGC, but you grant Battle4Arena a worldwide, non-exclusive, royalty-free license to host, store, display, reproduce, and process UGC solely to operate, secure, and improve the Services, including dispute resolution and moderation.",
          },
          {
            type: "ul",
            items: [
              "Do not upload content you do not have rights to use (copyrighted videos/images, stolen proof, leaked private data).",
              "We may remove or restrict UGC that violates policies or law, or that creates safety or fraud risk.",
            ],
          },
        ],
      },
      {
        id: "ip",
        title: "Intellectual Property",
        blocks: [
          {
            type: "p",
            text:
              "Battle4Arena and its branding, UI, code, tournament tooling, and service features are protected by intellectual property laws. You may not copy, reverse engineer, scrape, or misuse the Services except as allowed by law.",
          },
          {
            type: "p",
            text:
              "Game publishers and their trademarks belong to their respective owners. Battle4Arena is an independent platform and is not affiliated with or endorsed by any game publisher unless explicitly stated.",
          },
        ],
      },
      {
        id: "liability",
        title: "Disclaimers And Limitation Of Liability",
        blocks: [
          {
            type: "ul",
            items: [
              "The Services are provided on an \"as is\" and \"as available\" basis. We do not guarantee uninterrupted access, latency-free gameplay, or error-free tournament outcomes.",
              "To the maximum extent permitted by law, Battle4Arena is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost prizes, loss of reputation, or loss of data.",
              "Our total liability for any claim related to the Services is limited to the amount you paid to Battle4Arena in the 30 days before the event giving rise to the claim (or INR 1,000 if you paid nothing), unless applicable law requires otherwise.",
            ],
          },
        ],
      },
      {
        id: "termination",
        title: "Suspension, Termination, And Appeals",
        blocks: [
          {
            type: "p",
            text:
              "We may warn, restrict features, mute chat, disqualify participants, suspend accounts, or ban users/creators for violating policies, attempting fraud, or creating platform risk. We may also restrict access to protect investigations, victims, and platform integrity.",
          },
          {
            type: "ul",
            items: [
              "Appeals may be submitted through the in-app report/support flow. Provide evidence and keep communication respectful.",
              "We may retain logs and evidence linked to disputes, fraud, or safety incidents for lawful and operational reasons.",
            ],
          },
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: [
          {
            type: "p",
            text:
              `For policy questions, safety concerns, or legal requests, contact us at ${SUPPORT_EMAIL}. For urgent tournament disputes, use the in-app report flow to attach evidence and timestamps.`,
          },
        ],
      },
    ],
  },
  {
    id: "tournament-rules",
    title: "Tournament Rules & Regulations",
    shortTitle: "Tournament Rules",
    icon: Swords,
    description: "Standard tournament rules for eligibility, punctuality, room behavior, evidence, and penalties.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Tournament Rules covering joining requirements, conduct, evidence submission, disconnect rules, penalties, and prize claiming.",
    sections: [
      {
        id: "overview",
        title: "Core Principles",
        blocks: [
          {
            type: "ul",
            items: [
              "Fair play is mandatory: win by skill, not by tools, exploits, or abuse.",
              "Be punctual and prepared: join on time, follow the room instructions, and keep proof for disputes.",
              "Respect creators, admins, and players: toxic conduct can lead to penalties even if you win.",
            ],
          },
        ],
      },
      {
        id: "joining",
        title: "Joining Requirements And Check-In",
        blocks: [
          {
            type: "ul",
            items: [
              "Use your own verified game account and your Battle4Arena account. Account sharing is prohibited.",
              "Join only if you can play at the scheduled time. Late arrival may result in slot loss or disqualification.",
              "Creators/admins may require check-in within a window (example: 10–15 minutes before match). Failure to check in can be treated as a no-show.",
              "If a tournament requires a specific region/server, device type, or game version, you must comply.",
            ],
          },
        ],
      },
      {
        id: "room",
        title: "Room Rules, IDs, And Passwords",
        blocks: [
          {
            type: "ul",
            items: [
              "Room ID/password are shared for eligible participants only. Do not forward or post them publicly.",
              "Do not attempt to join with extra accounts, substitute players without approval, or unauthorized teammates.",
              "Follow slot numbers, team size, and game mode. Wrong slot/lineup can be penalized even if results look valid.",
              "If you cannot access the room due to verified platform error, report immediately with screenshots and timestamps.",
            ],
          },
        ],
      },
      {
        id: "conduct",
        title: "Match Conduct And Player Behavior",
        blocks: [
          {
            type: "ul",
            items: [
              "No stream sniping, collusion, teaming, win-trading, or intentional feeding.",
              "No harassment, hate speech, threats, or abusive language in voice/text during the event.",
              "Do not exploit rule loopholes. If something feels like an exploit, treat it as prohibited and report it.",
            ],
          },
        ],
      },
      {
        id: "disconnect",
        title: "Disconnects, Device Issues, And Restarts",
        blocks: [
          {
            type: "p",
            text:
              "Mobile esports events have real-world connectivity constraints. Unless explicitly stated in a tournament's special rules, disconnects are typically the player's responsibility. Admins may make exceptions only when there is strong evidence of server-wide issues or organizer faults.",
          },
          {
            type: "ul",
            items: [
              "Keep stable internet and sufficient battery. Do not start if your device is unstable.",
              "Intentional disconnects (Alt+F4, forced close, airplane mode toggling) can be treated as cheating or match manipulation.",
              "If a tournament is restarted, prior screenshots/claims may be void unless admins confirm otherwise.",
            ],
          },
        ],
      },
      {
        id: "evidence",
        title: "Evidence Submission Standards",
        blocks: [
          {
            type: "ul",
            items: [
              "Submit clear proof: full screenshots (with time), match summary screens, result pages, or video clips with visible player IDs.",
              "Do not crop out critical info. Cropped or edited proof can be rejected.",
              "False evidence or impersonation is a severe offense and may lead to bans and wallet reversals.",
            ],
          },
        ],
      },
      {
        id: "penalties",
        title: "Penalties And Disqualification",
        blocks: [
          {
            type: "ul",
            items: [
              "Warnings for minor first-time issues (chat toxicity, late arrival with no impact) when appropriate.",
              "Match penalty/disqualification for rule violations (wrong slot, unapproved substitutes, result manipulation attempts).",
              "Tournament ban or platform ban for cheating, hacking, exploit abuse, fraud, harassment, or repeated violations.",
              "Prize cancellation or wallet reversal for illegitimate wins or manipulated results.",
            ],
          },
          {
            type: "callout",
            tone: "warn",
            title: "Device Integrity",
            text:
              "Using rooted/jailbroken devices, emulators, or software with modification/debugging features can be treated as a high-risk fair play violation in competitive events and may lead to disqualification.",
          },
        ],
      },
      {
        id: "prizes",
        title: "Prize Distribution And Claims",
        blocks: [
          {
            type: "ul",
            items: [
              "Prize distribution can be delayed for result validation, fraud checks, or dispute resolution.",
              "If a payout is disputed, admins may require additional evidence from both players and creators.",
              "If you are disqualified or results are voided, you are not eligible for the associated prize.",
              "Repeated abusive disputes, spam reporting, or threatening staff can lead to moderation actions.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    icon: ShieldCheck,
    description: "How Battle4Arena collects, uses, shares, and protects personal data for tournaments and wallet operations.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Privacy Policy describing data collection, cookies, analytics, security, retention, third parties, and user rights.",
    sections: [
      {
        id: "scope",
        title: "Scope And Definitions",
        blocks: [
          {
            type: "p",
            text:
              "This Privacy Policy explains how Battle4Arena processes personal data when you use our Services. \"Personal data\" means information that identifies or can reasonably be linked to you, such as your email/phone, device identifiers, and payment/tournament records.",
          },
        ],
      },
      {
        id: "data-we-collect",
        title: "Information We Collect",
        blocks: [
          {
            type: "ul",
            items: [
              "Account data: username, email, phone number, profile details, login method, and account status.",
              "Authentication data: OTP delivery metadata, login timestamps, and security events (we do not store OTP values in plain text).",
              "Tournament data: registrations, teams/slots, room share events, match results, reports, evidence files/links, and moderation actions.",
              "Wallet/payment data: deposits, withdrawals, transfers, prizes, refunds, payment order IDs/status, and fraud/chargeback signals.",
              "Device/network data: IP address, device type, app version, language, crash logs, and security telemetry for abuse prevention.",
              "Communications: support tickets, report messages, and chat content when used for safety or dispute resolution.",
            ],
          },
        ],
      },
      {
        id: "how-we-use",
        title: "How We Use Information",
        blocks: [
          {
            type: "ul",
            items: [
              "Operate tournaments: registration, slot handling, room credential distribution, result validation, prize processing.",
              "Secure accounts: OTP/login protection, suspicious activity detection, rate limiting, and breach response.",
              "Prevent fraud: payment screening, chargeback handling, wallet abuse detection, and dispute investigations.",
              "Moderate the community: enforce policies, investigate reports, prevent harassment and scams.",
              "Improve the Services: analytics, performance monitoring, UX improvements, and feature reliability.",
              "Comply with law: tax/accounting, anti-fraud obligations, and responding to lawful requests.",
            ],
          },
        ],
      },
      {
        id: "cookies",
        title: "Cookies, Sessions, And Analytics",
        blocks: [
          {
            type: "p",
            text:
              "We use cookies or similar storage (such as local storage) for session management, security, preferences, and performance. We may use privacy-friendly analytics to understand how features are used and to detect breakage.",
          },
          {
            type: "ul",
            items: [
              "Essential cookies: required for login sessions, security protections, and feature operation.",
              "Preference storage: UI preferences and device settings to improve usability.",
              "Analytics/performance: aggregated usage and crash/performance signals to improve stability.",
            ],
          },
        ],
      },
      {
        id: "sharing",
        title: "How We Share Information",
        blocks: [
          {
            type: "ul",
            items: [
              "With creators/participants: limited tournament-related data needed to run the event (for example, usernames, slot/team info, and verified results).",
              "With service providers: payment processors, OTP/email providers, hosting/analytics, and security tooling that help us deliver the Services.",
              "For safety/legal: to prevent harm, address fraud, enforce policies, or respond to lawful requests.",
              "We do not sell personal data. We do not share full payment instrument details; those are handled by payment providers.",
            ],
          },
        ],
      },
      {
        id: "security",
        title: "Security Measures",
        blocks: [
          {
            type: "ul",
            items: [
              "Access controls and least-privilege permissions for admin tools.",
              "Audit logging for sensitive operations (wallet actions, moderation, room sharing).",
              "Rate limits and automated checks to reduce spam, brute force attempts, and abuse.",
              "Incident response workflows for compromised accounts, fraud attempts, and safety issues.",
            ],
          },
        ],
      },
      {
        id: "retention",
        title: "Retention",
        blocks: [
          {
            type: "p",
            text:
              "We retain data for as long as needed to provide the Services, comply with legal obligations, and resolve disputes. Tournament and wallet records may be retained longer than general profile data because they are tied to fraud prevention, accounting, and dispute resolution.",
          },
        ],
      },
      {
        id: "your-rights",
        title: "Your Rights And Choices",
        blocks: [
          {
            type: "ul",
            items: [
              "Access and correction: you can review and update your profile details inside the app.",
              "Deletion: you can request account deletion; some records may be retained where required for fraud, disputes, or legal compliance.",
              "Opt-out: you may be able to disable non-essential notifications or marketing messages (security notifications may still be sent).",
              "Complaints: contact support if you believe data is incorrect or used improperly.",
            ],
          },
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: [
          {
            type: "p",
            text: `For privacy requests and questions, email ${SUPPORT_EMAIL}. Include your account username and the type of request (access, correction, deletion, or other).`,
          },
        ],
      },
    ],
  },
  {
    id: "community",
    title: "Community Guidelines",
    shortTitle: "Community",
    icon: Handshake,
    description: "Rules for respectful communication, safe competition, and healthy gaming communities.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Community Guidelines covering respectful behavior, anti-harassment, scams, spam, and safe communication standards.",
    sections: [
      {
        id: "respect",
        title: "Respectful Behavior",
        blocks: [
          {
            type: "ul",
            items: [
              "Treat others with respect. Competitive banter is fine; targeted abuse is not.",
              "No hate speech, discrimination, or dehumanizing content based on protected characteristics.",
              "No harassment, stalking, sexual harassment, or intimidation of players, creators, or staff.",
              "No threats of violence or self-harm content directed at others.",
            ],
          },
        ],
      },
      {
        id: "safety",
        title: "Safety And Privacy",
        blocks: [
          {
            type: "ul",
            items: [
              "Do not share another person’s private info (phone numbers, addresses, payment details, social accounts) without permission.",
              "Do not ask users for OTPs, passwords, or account recovery codes. Staff will never request your OTP.",
              "Do not post room passwords publicly. Room credentials are match-sensitive and should remain in eligible circles only.",
            ],
          },
        ],
      },
      {
        id: "scams",
        title: "Scams, Fraud, And Impersonation",
        blocks: [
          {
            type: "ul",
            items: [
              "No scams, phishing links, fake giveaways, or \"free UC\" style deception.",
              "No impersonation of players, creators, admins, payment agents, or external brands.",
              "No off-platform payment pressure. Use the platform wallet/flows where provided.",
            ],
          },
        ],
      },
      {
        id: "content",
        title: "Content Standards",
        blocks: [
          {
            type: "ul",
            items: [
              "No NSFW content, sexual content involving minors, or exploitative imagery.",
              "No extremist content or incitement of violence.",
              "No repeated spam, copy-paste walls, or disruptive advertising.",
            ],
          },
        ],
      },
      {
        id: "enforcement",
        title: "Enforcement",
        blocks: [
          {
            type: "p",
            text:
              "Violations may result in message removal, chat mutes, tournament penalties, account restrictions, or bans. Enforcement considers severity, frequency, and evidence quality.",
          },
        ],
      },
    ],
  },
  {
    id: "refund-wallet",
    title: "Refund & Wallet Policy",
    shortTitle: "Refunds & Wallet",
    icon: Wallet,
    description: "How deposits, entry fees, refunds, chargebacks, withdrawals, and wallet reversals are handled.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Refund & Wallet Policy describing deposits, entry fees, cancellations, refunds, withdrawals, chargebacks, and fraud controls.",
    sections: [
      {
        id: "wallet-basics",
        title: "Wallet Basics",
        blocks: [
          {
            type: "p",
            text:
              "Your wallet balance can be used for tournament entry fees and may receive prizes or refunds. Wallet features are designed for tournament operations and safety, not as a replacement for a bank account.",
          },
          {
            type: "ul",
            items: [
              "Deposits: adding money via supported payment methods (availability may vary).",
              "Debits: entry fees, transfers (if enabled), or other platform-authorized charges.",
              "Credits: prizes, refunds, promotional bonuses (when offered), and reversals.",
            ],
          },
        ],
      },
      {
        id: "entry-fees",
        title: "Tournament Entry Fees",
        blocks: [
          {
            type: "ul",
            items: [
              "Entry fees are deducted at the time you join/register a tournament.",
              "If you voluntarily leave a tournament after the registration window or after the match begins, entry fees are typically non-refundable.",
              "If a tournament is canceled by the organizer/admin before it starts, entry fees may be refunded to the wallet after verification.",
              "If you are removed for policy violations (cheating, abuse, fraud), refunds may be denied.",
            ],
          },
        ],
      },
      {
        id: "refunds",
        title: "Refund Conditions",
        blocks: [
          {
            type: "ul",
            items: [
              "Refund eligibility depends on timing, tournament status, and whether you complied with rules.",
              "Refunds can be delayed when there are disputes, suspected fraud, or ongoing investigations.",
              "Platform/processor fees may be non-refundable in some cases (for example, when the payment processor does not return fees).",
              "We may reverse refunds if later evidence shows manipulation or fraudulent claims.",
            ],
          },
        ],
      },
      {
        id: "withdrawals",
        title: "Withdrawals",
        blocks: [
          {
            type: "ul",
            items: [
              "Withdrawals may require identity or account verification to prevent fraud and comply with legal obligations.",
              "We may impose limits, cooldowns, or additional checks for high-risk patterns (multiple accounts, chargebacks, rapid deposits/withdrawals).",
              "Withdrawal requests may be paused during active disputes or when your account is restricted for policy review.",
            ],
          },
        ],
      },
      {
        id: "chargebacks",
        title: "Chargebacks And Payment Reversals",
        blocks: [
          {
            type: "p",
            text:
              "If a payment is charged back, reversed, or flagged as unauthorized, we may reverse associated wallet credits and restrict account functionality while investigating.",
          },
          {
            type: "ul",
            items: [
              "Accounts associated with repeated chargebacks may be banned and may lose access to prizes and withdrawal features.",
              "If you believe a chargeback was an error, contact support with payment reference details.",
            ],
          },
        ],
      },
      {
        id: "support",
        title: "Support And Dispute Flow",
        blocks: [
          {
            type: "p",
            text:
              `For refunds or wallet disputes, use the in-app report/support flow with tournament ID, transaction references, screenshots, and timestamps. You can also email ${SUPPORT_EMAIL} for non-urgent follow-ups.`,
          },
        ],
      },
    ],
  },
  {
    id: "fair-play",
    title: "Fair Play & Anti-Cheat Policy",
    shortTitle: "Fair Play",
    icon: Shield,
    description: "Anti-cheat rules, device integrity requirements, exploit bans, and competitive integrity enforcement.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Fair Play & Anti-Cheat Policy addressing cheats, exploits, devices, collusion, smurfing, and penalties.",
    sections: [
      {
        id: "zero-tolerance",
        title: "Zero Tolerance Cheating",
        blocks: [
          {
            type: "ul",
            items: [
              "No aimbots, ESP, wallhacks, radar, scripts, macros, recoil control tools, or unauthorized overlays.",
              "No modified clients, memory editing, injection, packet tampering, or bypassing game anti-cheat systems.",
              "No exploit abuse: using known bugs/glitches to gain competitive advantage.",
              "No collusion or win-trading, including teaming in solos/duos, or sharing opponent positions.",
            ],
          },
        ],
      },
      {
        id: "devices",
        title: "Device And Environment Integrity",
        blocks: [
          {
            type: "ul",
            items: [
              "Rooted/jailbroken devices, emulators, or systems with debugging/modification tools may be restricted for competitive events.",
              "Using VPNs/proxies to evade bans, manipulate region restrictions, or hide suspicious behavior can lead to penalties.",
              "Do not use accessibility tools or controller mappings that create unfair advantage when a tournament prohibits them.",
            ],
          },
        ],
      },
      {
        id: "multi-accounts",
        title: "Multiple Accounts, Smurfing, And Account Sharing",
        blocks: [
          {
            type: "ul",
            items: [
              "One real person should use one primary account. Multi-accounting for unfair advantage, bonuses, or slot manipulation is prohibited.",
              "Smurfing to manipulate matchmaking/brackets or to bypass restrictions can be penalized.",
              "Account sharing or playing on another person’s account is prohibited.",
            ],
          },
        ],
      },
      {
        id: "evidence",
        title: "Evidence And Investigations",
        blocks: [
          {
            type: "p",
            text:
              "Admins may review reports, gameplay proof, tournament logs, wallet patterns, device telemetry, and chat messages to validate fair play concerns. Investigations may require time; decisions may be updated if new evidence emerges.",
          },
        ],
      },
      {
        id: "penalties",
        title: "Penalty Ladder",
        blocks: [
          {
            type: "ul",
            items: [
              "Warning or temporary restriction for low-severity issues where intent is unclear.",
              "Match/tournament disqualification for verified competitive integrity violations.",
              "Prize cancellation and wallet reversal for illegitimate wins.",
              "Account suspension or permanent ban for cheating, repeated violations, or ban evasion.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "creator-rules",
    title: "Creator & Organizer Rules",
    shortTitle: "Creator Rules",
    icon: BadgeCheck,
    description: "Operational standards for creators running tournaments: transparency, room sharing, payouts, and trust.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Creator & Organizer Rules covering tournament setup standards, payouts, room sharing, moderation, and prohibited behavior.",
    sections: [
      {
        id: "responsibilities",
        title: "Core Responsibilities",
        blocks: [
          {
            type: "ul",
            items: [
              "Publish accurate tournament details: schedule, entry fee, prize amount/type, mode, rules, reporting requirements, and any device restrictions.",
              "Share room credentials to eligible participants only and at appropriate times. Do not sell room access or allow unauthorized joins.",
              "Treat participants fairly and avoid favoritism, threats, or retaliation against reporters.",
              "Maintain proof and records for disputes, including result screenshots and moderation actions.",
            ],
          },
        ],
      },
      {
        id: "payouts",
        title: "Prize Distribution Standards",
        blocks: [
          {
            type: "ul",
            items: [
              "Distribute prizes only after results are validated. Do not pay based on unverified screenshots when suspicious signals exist.",
              "If a dispute is opened, cooperate with admin investigation and provide logs/screenshots promptly.",
              "Do not demand off-platform payments for payouts or approvals. Keep financial flows inside approved wallet systems.",
            ],
          },
        ],
      },
      {
        id: "abuse",
        title: "Creator Abuse And Prohibited Conduct",
        blocks: [
          {
            type: "ul",
            items: [
              "No fake tournaments, bait-and-switch prize terms, or misleading listings.",
              "No intentional delays or refusals to resolve valid disputes.",
              "No collusion with players, win-trading facilitation, or preferential slot allocation for unfair advantage.",
              "No doxxing, harassment, or threats toward participants.",
            ],
          },
        ],
      },
      {
        id: "moderation",
        title: "Creator Moderation Powers",
        blocks: [
          {
            type: "p",
            text:
              "Creators may have limited moderation tools for their tournament spaces, but platform admins retain final authority for safety, fraud, and fair play enforcement. Misuse of moderation tools can result in creator privileges being reduced or revoked.",
          },
        ],
      },
    ],
  },
  {
    id: "moderation",
    title: "Reporting & Moderation Policy",
    shortTitle: "Reports & Moderation",
    icon: Ticket,
    description: "How to report issues, what evidence is needed, and how moderation decisions are made and appealed.",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "Battle4Arena Reporting & Moderation Policy including report workflow, evidence requirements, decision-making, penalties, and appeals.",
    sections: [
      {
        id: "how-to-report",
        title: "How To Report",
        blocks: [
          {
            type: "ul",
            items: [
              "Use the in-app report flow whenever possible so we can attach relevant tournament and message IDs.",
              "Include clear evidence: screenshots, full match results, video clips, timestamps, and player IDs.",
              "Describe what happened, where it happened (tournament, chat, profile), and why it violates a specific policy.",
              "Do not spam multiple reports for the same issue. Add new evidence to the existing report thread.",
            ],
          },
        ],
      },
      {
        id: "what-we-check",
        title: "What We Review",
        blocks: [
          {
            type: "ul",
            items: [
              "Tournament logs: joins/leaves, room share events, result submission timestamps, and moderation actions.",
              "Wallet records: entry fees, prizes, refunds, and suspicious transaction patterns.",
              "Evidence quality: clarity, authenticity, completeness, and consistency.",
              "Behavioral history: repeated toxicity, prior warnings, ban evasion attempts, or fraud signals.",
            ],
          },
        ],
      },
      {
        id: "actions",
        title: "Possible Outcomes",
        blocks: [
          {
            type: "ul",
            items: [
              "No action: when evidence is insufficient or the claim is not supported.",
              "Warning: for low-severity issues or first-time minor violations.",
              "Chat mute/restrictions: for toxic or disruptive behavior.",
              "Tournament penalties: result void, penalty points, disqualification.",
              "Account actions: temporary suspension, permanent ban, creator privilege removal.",
              "Wallet actions: payout holds, reversals, refunds, or fraud blocks where justified.",
            ],
          },
        ],
      },
      {
        id: "false-reports",
        title: "False Reports And Abuse Of The System",
        blocks: [
          {
            type: "ul",
            items: [
              "Knowingly submitting fake evidence or coordinated false reports is a serious violation.",
              "Abusing reports to harass others may lead to restrictions or bans.",
              "Repeated low-quality spam reports may reduce your report priority and limit your reporting features.",
            ],
          },
        ],
      },
      {
        id: "appeals",
        title: "Appeals",
        blocks: [
          {
            type: "p",
            text:
              "If you believe a moderation decision is incorrect, you may appeal through the same report thread or via support. Provide new information or clarify misunderstandings. Appeals that include threats, spam, or harassment will be closed.",
          },
        ],
      },
      {
        id: "severe",
        title: "Severe Violations",
        blocks: [
          {
            type: "callout",
            tone: "warn",
            title: "Zero Tolerance Safety Cases",
            text:
              "We may immediately restrict accounts and preserve evidence in cases involving credible threats, child safety concerns, severe harassment, payment fraud, or cheating operations.",
          },
          {
            type: "p",
            text: `If there is an immediate safety risk, stop engaging and contact support at ${SUPPORT_EMAIL}.`,
          },
        ],
      },
      {
        id: "contact",
        title: "Contact",
        blocks: [
          {
            type: "p",
            text:
              `Policy questions can be emailed to ${SUPPORT_EMAIL}. For tournament issues, the in-app report flow is strongly preferred because it links directly to tournament and message context.`,
          },
        ],
      },
    ],
  },
];

const docsById = Object.fromEntries(DOCS.map((doc) => [doc.id, doc])) as Record<DocId, LegalDoc>;
const defaultDocId: DocId = "terms";

const LegalCenterScreen = () => {
  const navigate = useNavigate();
  const { doc: docParam } = useParams<{ doc?: string }>();
  const docId = (Object.keys(docsById) as DocId[]).includes(docParam as DocId) ? (docParam as DocId) : defaultDocId;
  const doc = docsById[docId];

  const [query, setQuery] = useState("");

  const sectionsWithSearchText = useMemo(() => {
    return doc.sections.map((section) => {
      const blockText = section.blocks
        .map((block) => {
          if (block.type === "p") return block.text;
          if (block.type === "ul") return block.items.join(" ");
          return `${block.title} ${block.text}`;
        })
        .join(" ");
      return { ...section, searchText: `${section.title} ${blockText}` };
    });
  }, [doc.sections]);

  const visibleSections = useMemo(() => {
    const q = query.trim();
    if (!q) return sectionsWithSearchText;
    return sectionsWithSearchText.filter((section) => containsQuery(section.searchText, q));
  }, [query, sectionsWithSearchText]);

  const toc = useMemo(() => {
    return visibleSections.map((section) => ({ id: section.id, title: section.title }));
  }, [visibleSections]);

  useEffect(() => {
    document.title = `${doc.title} | Battle4Arena`;
    const metaName = "description";
    let tag = document.querySelector(`meta[name="${metaName}"]`) as HTMLMetaElement | null;
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = metaName;
      document.head.appendChild(tag);
    }
    tag.content = doc.seoDescription;
  }, [doc.id, doc.seoDescription, doc.title]);

  useEffect(() => {
    setQuery("");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [docId]);

  const scrollTo = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const Sidebar = ({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) => (
    <div className={cn(compact ? "space-y-4" : "space-y-5")}>
      <div>
        <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground">Documents</p>
        <div className="mt-2 grid gap-1.5">
          {DOCS.map((item) => (
            <Link
              key={item.id}
              to={`/legal/${item.id}`}
              onClick={onNavigate}
              className={cn(
                "arena-focus flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                item.id === docId
                  ? "border-primary/35 bg-primary/10 text-foreground"
                  : "border-glass-border bg-card/70 text-muted-foreground hover:border-primary/30 hover:bg-background/35 hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", item.id === docId ? "text-primary" : "text-secondary")} />
              <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold">{item.shortTitle}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className={cn("rounded-lg border border-glass-border bg-card/70 p-3", compact && "p-3")}>
        <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground">On This Page</p>
        <div className="mt-2 grid gap-1.5">
          {toc.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sections match your search.</p>
          ) : (
            toc.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  scrollTo(item.id);
                  onNavigate?.();
                }}
                className="text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.title}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const MobileSidebar = () => (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground">Documents</p>
        <div className="mt-2 grid gap-1.5">
          {DOCS.map((item) => (
            <SheetClose key={item.id} asChild>
              <Link
                to={`/legal/${item.id}`}
                className={cn(
                  "arena-focus flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                  item.id === docId
                    ? "border-primary/35 bg-primary/10 text-foreground"
                    : "border-glass-border bg-card/70 text-muted-foreground hover:border-primary/30 hover:bg-background/35 hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", item.id === docId ? "text-primary" : "text-secondary")} />
                <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold">{item.shortTitle}</span>
              </Link>
            </SheetClose>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-glass-border bg-card/70 p-3">
        <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground">On This Page</p>
        <div className="mt-2 grid gap-1.5">
          {toc.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sections match your search.</p>
          ) : (
            toc.map((item) => (
              <SheetClose key={item.id} asChild>
                <button type="button" onClick={() => scrollTo(item.id)} className="text-left text-xs text-muted-foreground hover:text-foreground">
                  {item.title}
                </button>
              </SheetClose>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="arena-shell min-h-screen">
      <header className="sticky top-0 z-20 border-b border-glass-border bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-5">
          <Button variant="soft" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <doc.icon className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="truncate font-heading text-lg font-bold sm:text-xl">{doc.title}</h1>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              Last updated {doc.lastUpdated} · Contact {SUPPORT_EMAIL}
            </p>
          </div>

          <div className="hidden w-[320px] items-center gap-2 sm:flex">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in this policy…"
              className="h-10 bg-card/70"
            />
          </div>

          <div className="sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="neon" size="icon" aria-label="Open contents">
                  <FileText className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-4">
                <SheetHeader>
                  <SheetTitle>Legal Center</SheetTitle>
                  <SheetDescription>Choose a document and jump to any section.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search…"
                      className="h-10 bg-card/70"
                    />
                  </div>
                  <ScrollArea className="h-[72vh] pr-2">
                    <MobileSidebar />
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-16 pt-5 sm:px-5 lg:grid-cols-[320px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-[90px]">
            <ScrollArea className="h-[calc(100dvh-130px)] pr-3">
              <Sidebar />
            </ScrollArea>
          </div>
        </aside>

        <main>
          <GlassCard neon className="mb-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10">
                <doc.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-heading text-base font-bold">Summary</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{doc.description}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <GlassCard className="bg-background/25 p-3">
                    <p className="font-heading text-xs font-bold">Quick Links</p>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <Link className="hover:text-foreground" to="/legal/terms">Terms & Conditions</Link>
                      <Link className="hover:text-foreground" to="/legal/privacy">Privacy Policy</Link>
                      <Link className="hover:text-foreground" to="/legal/tournament-rules">Tournament Rules</Link>
                      <Link className="hover:text-foreground" to="/legal/fair-play">Fair Play</Link>
                    </div>
                  </GlassCard>
                  <GlassCard className="bg-background/25 p-3">
                    <p className="font-heading text-xs font-bold">Policy Set</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full border border-glass-border bg-card/70 px-2 py-1">Safety</span>
                      <span className="rounded-full border border-glass-border bg-card/70 px-2 py-1">Wallet</span>
                      <span className="rounded-full border border-glass-border bg-card/70 px-2 py-1">Tournaments</span>
                      <span className="rounded-full border border-glass-border bg-card/70 px-2 py-1">Moderation</span>
                    </div>
                  </GlassCard>
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="lg:hidden">
            <GlassCard className="mb-4 bg-card/80">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search in this policy…"
                  className="h-10 bg-background/35"
                />
              </div>
            </GlassCard>
          </div>

          <div className="space-y-4">
            <div className="hidden sm:block">
              {visibleSections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-28">
                  <GlassCard>
                    <h2 className="font-heading text-base font-bold">{section.title}</h2>
                    <div className="mt-3 space-y-3">
                      {section.blocks.map((block, idx) => (
                        <div key={`${section.id}-${idx}`}>{renderBlock(block)}</div>
                      ))}
                    </div>
                  </GlassCard>
                </section>
              ))}
            </div>

            <div className="sm:hidden">
              <Accordion type="multiple" className="rounded-lg border border-glass-border bg-card/70">
                {visibleSections.map((section) => (
                  <AccordionItem key={section.id} value={section.id} className="border-glass-border px-3">
                    <AccordionTrigger className="font-heading text-sm font-bold text-foreground hover:no-underline">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pb-5">
                      {section.blocks.map((block, idx) => (
                        <div key={`${section.id}-${idx}`}>{renderBlock(block)}</div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <GlassCard className="mt-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/10">
                  <Flag className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-bold">Policy Notes</h2>
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <p>
                      Battle4Arena may update policies to improve safety, fairness, and compliance. Changes take effect when published in the Legal Center.
                    </p>
                    <p className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-amber-300" />
                      <span>Policy violations can result in tournament penalties, wallet holds, restrictions, or bans.</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-primary" />
                      <span>For disputes, use the in-app report system and attach evidence (screenshots/video/IDs).</span>
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LegalCenterScreen;
