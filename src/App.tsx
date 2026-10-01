/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

// Custom useTypewriter hook
function useTypewriter(
  text: string,
  speed: number = 38,
  startDelay: number = 600,
) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let index = 0;
    let timer: NodeJS.Timeout | null = null;
    let interval: NodeJS.Timeout | null = null;

    setDisplayed("");
    setDone(false);

    timer = setTimeout(() => {
      interval = setInterval(() => {
        if (index < text.length) {
          index++;
          setDisplayed(text.slice(0, index));
        } else {
          if (interval) clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

interface ProjectData {
  id: string;
  title: string;
  category: string;
  highlight: string;
  description: string;
  metrics: string[];
  tags: string[];
  githubUrl: string;
  demoUrl?: string;
  architecture: string[];
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const targetTimeRef = useRef<number>(0);
  const currentSmoothRef = useRef<number>(0);
  const lastWrittenRef = useRef<number>(0);
  const sampledRef = useRef<boolean>(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pillsVisible, setPillsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeResumeModal, setActiveResumeModal] = useState(false);
  const [contactStatus, setContactStatus] = useState<
    "idle" | "submitting" | "sent"
  >("idle");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [contactError, setContactError] = useState(false);
  const [botcheck, setBotcheck] = useState(false);

  // Typewriter text requested by user
  const typewriterText =
    "Glad you stopped by. I build AI products that actually work. Want to see what I've shipped?";
  const { displayed, done } = useTypewriter(typewriterText, 38, 600);

  // Pills become visible 400ms after load
  useEffect(() => {
    const timer = setTimeout(() => {
      setPillsVisible(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // SMOOTHED INTERPOLATION REQUEST ANIMATION FRAME LOOP:
  // currentSmooth += (targetTime - currentSmooth) * 0.08
  // Only write currentTime when difference from last written value > 0.01s, and skip while video.seeking is true
  useEffect(() => {
    let animId: number;

    const smoothLoop = () => {
      const video = videoRef.current;
      if (video && video.duration && !Number.isNaN(video.duration)) {
        currentSmoothRef.current +=
          (targetTimeRef.current - currentSmoothRef.current) * 0.08;

        if (
          !video.seeking &&
          Math.abs(currentSmoothRef.current - lastWrittenRef.current) > 0.01
        ) {
          try {
            video.currentTime = currentSmoothRef.current;
            lastWrittenRef.current = currentSmoothRef.current;
          } catch {
            // Ignore transient seek errors
          }
        }
      }
      animId = requestAnimationFrame(smoothLoop);
    };

    animId = requestAnimationFrame(smoothLoop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // 1. Background color sampling: draw first frame to hidden canvas, read top-left pixel
  const sampleColorFromVideo = useCallback((video: HTMLVideoElement) => {
    if (sampledRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 32, 32);
      const pixel = ctx.getImageData(4, 4, 1, 1).data;
      const [r, g, b] = pixel;

      // Check if pixel is a valid warm/orange tone
      if (r > 150 && g > 40 && b < 100) {
        const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
        document.documentElement.style.setProperty("--bg-orange", hex);
        const meta = document.getElementById("theme-color-meta");
        if (meta) {
          meta.setAttribute("content", hex);
        }
        sampledRef.current = true;
      }
    } catch {
      // Keep fallback #FF7A0A on any sampling issue
    }
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video && video.duration) {
      // Default to center pose (looking forward)
      const centerTime = video.duration * 0.5;
      targetTimeRef.current = centerTime;
      currentSmoothRef.current = centerTime;
      lastWrittenRef.current = centerTime;
      try {
        video.currentTime = centerTime;
      } catch {
        // ignore initial seek error
      }
      sampleColorFromVideo(video);
    }
  };

  const handleLoadedData = () => {
    const video = videoRef.current;
    if (video) {
      sampleColorFromVideo(video);
    }
  };

  // EYES FOLLOW MOUSE / TOUCH:
  // Lowered sensitivity slightly around center to prevent big jumps from small mouse movements
  useEffect(() => {
    const computeTargetTime = (clientX: number, duration: number) => {
      const rawProgress = Math.min(Math.max(clientX / window.innerWidth, 0), 1);
      const centered = rawProgress - 0.5;
      // Gentle curve dampens micro-movements around center while keeping full range
      const dampedProgress =
        0.5 +
        Math.sign(centered) * Math.pow(Math.abs(centered) * 2, 1.15) * 0.5;
      return Math.min(Math.max(dampedProgress, 0), 1) * duration;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const video = videoRef.current;
      if (!video || !video.duration || Number.isNaN(video.duration)) return;
      targetTimeRef.current = computeTargetTime(e.clientX, video.duration);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const video = videoRef.current;
      if (
        !video ||
        !video.duration ||
        Number.isNaN(video.duration) ||
        !e.touches[0]
      )
        return;
      targetTimeRef.current = computeTargetTime(
        e.touches[0].clientX,
        video.duration,
      );
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("kasivishwanath0000@gmail.com");
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const navOffset = 70;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const handleContactSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (botcheck) return;
    setContactError(false);
    setContactStatus("submitting");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY,
          name: contactForm.name,
          email: contactForm.email,
          message: contactForm.message,
          subject: "New portfolio message from " + contactForm.name,
          from_name: "Portfolio Contact Form",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContactStatus("sent");
        setContactForm({ name: "", email: "", message: "" });
        setTimeout(() => setContactStatus("idle"), 5000);
      } else {
        setContactStatus("idle");
        setContactError(true);
      }
    } catch {
      setContactStatus("idle");
      setContactError(true);
    }
  };
  //<!-- DUMMY CONTACT FORM -->
  // const handleContactSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setContactStatus('submitting');
  //   setTimeout(() => {
  //     setContactStatus('sent');
  //     setContactForm({ name: '', email: '', message: '' });
  //     setTimeout(() => setContactStatus('idle'), 5000);
  //   }, 900);
  // };

  const projects: ProjectData[] = [
    {
      id: "banking-fraud",
      title: "AI Banking Fraud Detection",
      category: "FinTech • Machine Learning • Real-Time Pipeline",
      highlight: "99.4% detection accuracy with <45ms transaction inference",
      description:
        "End-to-end intelligent transaction scoring engine designed for high-throughput banking systems. Combines XGBoost gradient boosting with variational autoencoders for zero-day anomaly classification, backed by SHAP explainability matrices for compliance transparency.",
      metrics: [
        "99.4% ROC-AUC",
        "<45ms Latency",
        "12K TPS Tested",
        "0.08% False Positives",
      ],
      tags: [
        "Python",
        "PyTorch",
        "XGBoost",
        "FastAPI",
        "Redis",
        "Kafka",
        "Docker",
      ],
      architecture: [
        "Stream Ingestion: Apache Kafka event streaming with Redis cache lookup",
        "Model Layer: Ensemble XGBoost + Autoencoder anomaly detector",
        "Explainability Engine: TreeSHAP score generation for compliance logs",
        "Delivery: Async FastAPI REST endpoints with Prometheus telemetry",
      ],
      githubUrl: "https://github.com/Kasiotsutsuki",
    },
    {
      id: "plant-doctor",
      title: "PlantDoctor AI",
      category: "Computer Vision • Agritech • Mobile Inference",
      highlight: "Identifies 38+ crop leaf pathogens from raw field photos",
      description:
        "Mobile-first diagnostic tool empowering farmers to instantly detect plant diseases in the field. Fine-tuned EfficientNet and MobileNet models optimized via ONNX Runtime for offline edge execution, paired with localized multi-lingual remedy generation.",
      metrics: [
        "96.8% Top-1 Accuracy",
        "38 Disease Classes",
        "Offline ONNX",
        "<12MB Footprint",
      ],
      tags: [
        "PyTorch",
        "EfficientNet",
        "ONNX Runtime",
        "Next.js",
        "Tailwind CSS",
        "PWA",
      ],
      architecture: [
        "Preprocessing: Adaptive image normalization & leaf contour segmentation",
        "Model Backbone: Transfer-learned EfficientNet-B2 with quantization",
        "Inference: Browser-side ONNX Runtime with fallback REST API",
        "Prescription Engine: Context-aware organic treatment recommendation",
      ],
      githubUrl: "https://github.com/Kasiotsutsuki/PlantDoctorAI",
    },
    {
      id: "log-monitoring",
      title: "Log Monitoring Automation",
      category: "DevOps AI • Distributed Systems • AIOps",
      highlight:
        "Reduces incident triage time by 74% with automated root cause clustering",
      description:
        "Autonomous log parsing and incident diagnostics platform for containerized microservice architectures. Employs vector semantic embeddings and density-based clustering to detect abnormal error cascades, correlate anomalies across distributed pods, and dispatch root-cause summaries.",
      metrics: [
        "74% Faster Triage",
        "99.8% Log Deduplication",
        "10M+ Logs/Day",
        "Instant Slack Alerts",
      ],
      tags: [
        "Python",
        "FastAPI",
        "Elasticsearch",
        "Sentence-Transformers",
        "ChromaDB",
        "Docker",
      ],
      architecture: [
        "Collection: FluentBit daemon collection across multi-node clusters",
        "Embedding: Sentence-transformer dense vectorization for log templates",
        "Clustering: HDBSCAN anomaly grouping & temporal spike correlation",
        "Automation: Automated webhook triggers with synthesized triage playbooks",
      ],
      githubUrl: "https://github.com/Kasiotsutsuki",
    },
  ];

  const skillsCategories = [
    {
      title: "AI & Machine Learning",
      items: [
        "PyTorch",
        "TensorFlow",
        "Scikit-learn",
        "XGBoost & LightGBM",
        "Hugging Face Transformers",
        "Computer Vision (YOLO/CNNs)",
        "LLMs & Prompt Systems",
        "RAG & Vector Databases",
        "Model Quantization & ONNX",
      ],
    },
    {
      title: "Backend & Distributed Systems",
      items: [
        "Python (FastAPI, Flask, Django)",
        "Node.js & Express",
        "Go (Golang basics)",
        "RESTful APIs & GraphQL",
        "PostgreSQL & MySQL",
        "Redis Caching & Pub/Sub",
        "Kafka Event Streaming",
        "Celery Task Queues",
      ],
    },
    {
      title: "Frontend & Modern Web",
      items: [
        "React & Next.js",
        "TypeScript & JavaScript (ESNext)",
        "Tailwind CSS",
        "State Management (Zustand/Redux)",
        "Responsive & Mobile-First UX",
        "Web Performance Optimization",
        "HTML5 Semantic Web",
        "Vite & Modern Bundlers",
      ],
    },
    {
      title: "DevOps & Developer Tools",
      items: [
        "Docker & Containerization",
        "Git & GitHub Workflows",
        "CI/CD Pipelines (GitHub Actions)",
        "Linux Environment & Bash",
        "AWS & Cloud Deployment",
        "Nginx & Reverse Proxies",
        "Postman API Testing",
        "Prometheus & Monitoring",
      ],
    },
  ];

  const achievements = [
    {
      year: "2026",
      title: "Master of Computer Applications (MCA)",
      org: "Postgraduate Degree Specialization in AI & Advanced Computing",
      desc: "Top academic standing with distinction in Machine Learning, Distributed Algorithms, Cloud Architecture, and Database Systems design.",
    },
    {
      year: "2025",
      title: "1st Place Winner — University AI Hackathon",
      org: "Autonomous Systems & Applied ML Category",
      desc: "Architected and presented a real-time computer vision edge inspection pipeline within 36 hours, evaluated by industry leaders.",
    },
    {
      year: "2025",
      title: "DeepLearning.AI Machine Learning Specialization",
      org: "Andrew Ng / Stanford Online Certification",
      desc: "Mastery in Supervised & Unsupervised Learning, Neural Networks, Decision Trees, Reinforcement Learning, and practical ML deployment.",
    },
    {
      year: "2024",
      title: "Open Source Contributor & Technical Speaker",
      org: "Developer Community & Campus Tech Guild",
      desc: "Delivered hands-on workshops on PyTorch fundamentals, REST API design with FastAPI, and building production-ready AI applications.",
    },
  ];

  return (
    <div
      className="relative w-full min-h-screen text-white select-text font-body"
      style={{ backgroundColor: "var(--bg-orange)" }}
    >
      {/* NAVBAR: fully transparent, logo/links sitting directly on background with text drop-shadow */}
      <header className="fixed top-0 left-0 right-0 z-30 px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center bg-transparent border-0 shadow-none transition-colors">
        {/* Logo (left): Kasi Vishwanath® */}
        <div className="flex flex-row items-center gap-2 sm:gap-3">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="text-[20px] sm:text-[26px] tracking-tight text-white font-heading select-none hover:opacity-80 transition-opacity drop-shadow-md"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Kasi Vishwanath®
          </a>
          <span
            className="text-[24px] sm:text-[30px] text-white select-none leading-none inline-block drop-shadow-md"
            style={{ letterSpacing: "-0.02em" }}
            aria-hidden="true"
          >
            ✳︎
          </span>
        </div>

        {/* Desktop nav links (center, hidden below md) */}
        <nav
          className="hidden md:flex flex-row items-center text-[22px] lg:text-[23px] text-white drop-shadow-md"
          aria-label="Desktop Navigation"
        >
          <button
            type="button"
            onClick={() => scrollToSection("projects")}
            className="hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit"
          >
            Projects
          </button>
          <span className="select-none text-white/75">,&nbsp;</span>
          <button
            type="button"
            onClick={() => scrollToSection("about")}
            className="hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit"
          >
            About
          </button>
          <span className="select-none text-white/75">,&nbsp;</span>
          <button
            type="button"
            onClick={() => scrollToSection("skills")}
            className="hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit"
          >
            Skills
          </button>
          <span className="select-none text-white/75">,&nbsp;</span>
          <button
            type="button"
            onClick={() => scrollToSection("contact")}
            className="hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit"
          >
            Contact
          </button>
        </nav>

        {/* Desktop CTA (right, hidden below md): Hire me */}
        <button
          type="button"
          onClick={() => scrollToSection("contact")}
          className="hidden md:inline-block text-[22px] lg:text-[23px] text-white underline underline-offset-2 hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-0 p-0 font-inherit drop-shadow-md"
        >
          Hire me
        </button>

        {/* Mobile hamburger (visible below md) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="md:hidden flex flex-col justify-center items-center gap-[5px] p-2 focus:outline-none z-40 cursor-pointer bg-transparent"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 origin-center drop-shadow-md ${
              mobileMenuOpen ? "rotate-45 translate-y-[7px]" : ""
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 drop-shadow-md ${
              mobileMenuOpen ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 origin-center drop-shadow-md ${
              mobileMenuOpen ? "-rotate-45 -translate-y-[7px]" : ""
            }`}
          />
        </button>
      </header>

      {/* Mobile overlay menu (sleek dark backdrop) */}
      <div
        className={`fixed inset-0 z-35 bg-black/95 backdrop-blur-xl flex flex-col justify-center items-start px-8 gap-8 md:hidden transition-all duration-300 ${
          mobileMenuOpen
            ? "opacity-100 pointer-events-auto visible"
            : "opacity-0 pointer-events-none invisible"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="flex flex-col gap-6">
          <button
            type="button"
            onClick={() => scrollToSection("projects")}
            className="text-[32px] font-medium text-white hover:text-orange-300 transition-colors text-left bg-transparent border-0 p-0"
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("about")}
            className="text-[32px] font-medium text-white hover:text-orange-300 transition-colors text-left bg-transparent border-0 p-0"
          >
            About
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("skills")}
            className="text-[32px] font-medium text-white hover:text-orange-300 transition-colors text-left bg-transparent border-0 p-0"
          >
            Skills
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("contact")}
            className="text-[32px] font-medium text-white hover:text-orange-300 transition-colors text-left bg-transparent border-0 p-0"
          >
            Contact
          </button>
          <button
            type="button"
            onClick={() => scrollToSection("contact")}
            className="text-[32px] font-medium text-white underline underline-offset-4 hover:text-orange-300 transition-colors pt-4 text-left bg-transparent border-0 p-0"
          >
            Hire me
          </button>
        </div>
      </div>

      {/* HERO SECTION: 100svh, min-height: 600px, touch-action: pan-y */}
      <main className="hero-section">
        {/* Background Avatar Video Wrapper (overflow: hidden crops scaled video & watermark) */}
        <div className="avatar-video-wrapper">
          <video
            ref={videoRef}
            src="https://res.cloudinary.com/u5usq4nz/video/upload/v1790834173/kling_20261001_VIDEO_animate__3181_0.mp4"
            muted
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={handleLoadedData}
            className="avatar-video-bg"
          >
            <source
              src="https://res.cloudinary.com/u5usq4nz/video/upload/v1790834173/kling_20261001_VIDEO_animate__3181_0.mp4"
              type="video/mp4"
            />
            <source src="/kasi_avatar.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Dark-orange scrim behind the text block (bottom 45% of hero, does not cover face) */}
        <div className="hero-scrim" aria-hidden="true" />

        {/* Hero Content Block:
            - Two-column hero layout with zero overlap:
            - Left column holds text and buttons with max-width: min(46vw, 560px) on desktop, 48vw on tablet
            - Right 50% reserved for character
            - Mobile (<640px): bottom area below top 55% video
        */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end md:justify-center px-5 sm:px-8 md:px-12 lg:px-16 pb-6 sm:pb-10 md:pb-0 pointer-events-none">
          <div className="hero-content-column pointer-events-auto">
            {/* 1. Blurred intro text */}
            <div
              className="pointer-events-none select-none mb-3 sm:mb-4"
              style={{
                fontSize: "clamp(15px, 2.8vw, 22px)",
                lineHeight: 1.3,
                fontWeight: 400,
                color: "#FFF4E6",
                opacity: 0.95,
                filter: "blur(1px)",
                textShadow: "0 2px 14px rgba(110, 35, 0, 0.45)",
              }}
            >
              Hey there, I'm Kasi.
              <br />
              MCA student, AI/ML &amp; full-stack developer
            </div>

            {/* 2. Typewriter heading: wraps strictly inside the left column */}
            <p
              className="text-white mb-4 sm:mb-6"
              style={{
                color: "#FFFFFF",
                fontWeight: 500,
                fontSize: "clamp(20px, 2.8vw, 38px)",
                lineHeight: 1.25,
                textShadow: "0 2px 18px rgba(110, 35, 0, 0.5)",
                minHeight: "58px",
              }}
            >
              {displayed}
              {!done && (
                <span
                  className="inline-block w-[2px] h-[1.1em] bg-white align-middle ml-[3px] animate-blink"
                  aria-hidden="true"
                />
              )}
            </p>

            {/* 3. Action pill buttons */}
            <div
              className="flex flex-wrap items-center gap-[10px]"
              style={{
                opacity: pillsVisible ? 1 : 0,
                transform: pillsVisible ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
              }}
            >
              {/* 4 white pill buttons */}
              <button
                type="button"
                onClick={() => scrollToSection("projects")}
                className="inline-flex items-center justify-center bg-white text-black font-medium rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.35em] whitespace-nowrap hover:bg-neutral-100 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                style={{ boxShadow: "0 4px 16px rgba(110, 35, 0, 0.25)" }}
              >
                View projects
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("contact")}
                className="inline-flex items-center justify-center bg-white text-black font-medium rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.35em] whitespace-nowrap hover:bg-neutral-100 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                style={{ boxShadow: "0 4px 16px rgba(110, 35, 0, 0.25)" }}
              >
                Hire me
              </button>

              <button
                type="button"
                onClick={() => scrollToSection("contact")}
                className="inline-flex items-center justify-center bg-white text-black font-medium rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.35em] whitespace-nowrap hover:bg-neutral-100 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                style={{ boxShadow: "0 4px 16px rgba(110, 35, 0, 0.25)" }}
              >
                Say hi
              </button>

              <button
                type="button"
                onClick={() => setActiveResumeModal(true)}
                className="inline-flex items-center justify-center bg-white text-black font-medium rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.35em] whitespace-nowrap hover:bg-neutral-100 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                style={{ boxShadow: "0 4px 16px rgba(110, 35, 0, 0.25)" }}
              >
                Download resume
              </button>

              {/* 1 outline pill button */}
              <button
                type="button"
                onClick={handleCopyEmail}
                title="Click to copy email address"
                className="inline-flex items-center justify-center rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.35em] whitespace-nowrap gap-2 sm:gap-3 hover:bg-white hover:text-black transition-all duration-200 cursor-pointer active:scale-[0.98] relative group"
                style={{
                  color: "#FFFFFF",
                  border: "1px solid rgba(255, 255, 255, 0.8)",
                  boxShadow: "0 4px 16px rgba(110, 35, 0, 0.25)",
                  backgroundColor: "rgba(110, 35, 0, 0.3)",
                }}
              >
                <span>
                  <span className="underline underline-offset-1">
                    kasivishwanath0000@gmail.com
                  </span>
                </span>

                {/* Small 12x12 copy icon */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0 stroke-current"
                  aria-hidden="true"
                >
                  <rect
                    x="3.5"
                    y="1.5"
                    width="7"
                    height="7"
                    rx="1"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M1.5 4.5V9.5C1.5 10.0523 1.94772 10.5 2.5 10.5H7.5"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Copied feedback badge */}
                {copied && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[11px] px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap border border-white/20">
                    Copied to clipboard!
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Scroll down indicator */}
        <div className="hidden md:flex absolute bottom-6 right-8 items-center gap-2 text-white/85 text-[13px] tracking-wide select-none drop-shadow-md z-10">
          <span>Move cursor to track eyes • Scroll for projects</span>
          <span className="animate-bounce">↓</span>
        </div>
      </main>

      {/* SECTIONS WRAPPER (Deep dark luxury canvas with pure white content) */}
      <div className="relative z-10 bg-[#0c0c0e] text-white border-t border-white/10 shadow-2xl">
        {/* SECTION: ABOUT */}
        <section
          id="about"
          className="py-24 sm:py-32 px-5 sm:px-8 md:px-12 max-w-7xl mx-auto border-b border-white/10"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            <div className="lg:col-span-4">
              <span className="text-[13px] uppercase tracking-widest text-orange-400 font-medium">
                01 / Background
              </span>
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-heading tracking-tight mt-3 text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Crafting intelligent code with purpose.
              </h2>
            </div>

            <div className="lg:col-span-8 space-y-6 text-[17px] sm:text-[19px] leading-relaxed text-white/85 font-normal">
              <p>
                I am{" "}
                <strong className="text-white font-semibold">
                  B. Kasi Vishwanath
                </strong>
                , a Master of Computer Applications (MCA) student specializing
                in{" "}
                <strong className="text-white font-semibold">
                  Applied AI/Machine Learning
                </strong>{" "}
                and{" "}
                <strong className="text-white font-semibold">
                  Full-Stack System Architecture
                </strong>
                .
              </p>
              <p>
                My focus lies at the intersection of mathematical machine
                learning models and high-throughput production software. Rather
                than training models that only live in notebooks, I architect
                end-to-end distributed pipelines: from real-time data ingestion
                and fine-tuning to low-latency APIs and intuitive user
                interfaces.
              </p>
              <p>
                Whether it is catching multi-million dollar banking fraud
                transactions in under 45 milliseconds, delivering offline
                computer vision diagnostics to crop farmers on low-bandwidth
                devices, or automating distributed microservice log monitoring,
                I treat software craft as an engineering discipline.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-white/10">
                <div>
                  <div className="text-2xl sm:text-3xl font-heading font-semibold text-white">
                    MCA
                  </div>
                  <div className="text-[13px] text-white/50 mt-1 uppercase tracking-wider">
                    Postgrad Degree
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-heading font-semibold text-white">
                    3+
                  </div>
                  <div className="text-[13px] text-white/50 mt-1 uppercase tracking-wider">
                    Core AI Systems
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-heading font-semibold text-white">
                    &lt;45ms
                  </div>
                  <div className="text-[13px] text-white/50 mt-1 uppercase tracking-wider">
                    Avg Inference
                  </div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-heading font-semibold text-white">
                    100%
                  </div>
                  <div className="text-[13px] text-white/50 mt-1 uppercase tracking-wider">
                    Production Focus
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: PROJECTS */}
        <section
          id="projects"
          className="py-24 sm:py-32 px-5 sm:px-8 md:px-12 max-w-7xl mx-auto border-b border-white/10"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-4">
            <div>
              <span className="text-[13px] uppercase tracking-widest text-orange-400 font-medium">
                02 / Selected Works
              </span>
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-heading tracking-tight mt-3 text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Featured Engineering Projects
              </h2>
            </div>
            <p className="text-[15px] text-white/60 max-w-md">
              High-consequence machine learning systems, computer vision models,
              and distributed operational pipelines.
            </p>
          </div>

          <div className="space-y-12 sm:space-y-16">
            {projects.map((proj, idx) => (
              <article
                key={proj.id}
                className="group p-6 sm:p-10 rounded-2xl border border-white/10 hover:border-white/25 transition-all duration-300 bg-[#141417] shadow-xl"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-white/10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-mono text-white/40">
                        0{idx + 1}
                      </span>
                      <span className="text-[13px] uppercase tracking-wider text-orange-300/80 font-medium">
                        {proj.category}
                      </span>
                    </div>
                    <h3
                      className="text-2xl sm:text-3xl font-heading tracking-tight text-white font-semibold"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {proj.title}
                    </h3>
                  </div>

                  <div className="inline-flex items-center self-start px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-white text-black">
                    {proj.highlight}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
                  <div className="lg:col-span-7 space-y-4">
                    <p className="text-[16px] sm:text-[17px] leading-relaxed text-white/80">
                      {proj.description}
                    </p>

                    <div>
                      <h4 className="text-[13px] uppercase tracking-wider text-white/50 font-medium mb-2">
                        System Architecture:
                      </h4>
                      <ul className="space-y-1.5 text-[14px] text-white/75">
                        {proj.architecture.map((item, aIdx) => (
                          <li key={aIdx} className="flex items-start gap-2">
                            <span className="text-orange-400 mt-1 select-none">
                              →
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                    <div>
                      <h4 className="text-[13px] uppercase tracking-wider text-white/50 font-medium mb-3">
                        Key Engineering Metrics:
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {proj.metrics.map((metric, mIdx) => (
                          <div
                            key={mIdx}
                            className="bg-[#1c1c20] border border-white/10 rounded-lg p-2.5 text-[13px] font-medium text-white"
                          >
                            {metric}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[13px] uppercase tracking-wider text-white/50 font-medium mb-2">
                        Technology Stack:
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {proj.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[12px] bg-white/10 text-white/90 px-2.5 py-1 rounded-md border border-white/5"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <a
                        href={proj.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[14px] font-medium text-white underline underline-offset-4 hover:text-orange-300 transition-colors"
                      >
                        <span>Inspect repository on GitHub</span>
                        <span>↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION: SKILLS */}
        <section
          id="skills"
          className="py-24 sm:py-32 px-5 sm:px-8 md:px-12 max-w-7xl mx-auto border-b border-white/10"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-4">
            <div>
              <span className="text-[13px] uppercase tracking-widest text-orange-400 font-medium">
                03 / Technical Mastery
              </span>
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-heading tracking-tight mt-3 text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Skills &amp; Capabilities
              </h2>
            </div>
            <p className="text-[15px] text-white/60 max-w-md">
              Core competencies spanning modern deep learning, robust backend
              microservices, and reactive user interfaces.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {skillsCategories.map((cat, idx) => (
              <div
                key={idx}
                className="p-8 rounded-2xl border border-white/10 bg-[#141417] hover:border-white/20 transition-all shadow-lg"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[12px] font-mono text-orange-400">
                    0{idx + 1}
                  </span>
                  <h3
                    className="text-xl font-heading font-semibold text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {cat.title}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {cat.items.map((item, iIdx) => (
                    <span
                      key={iIdx}
                      className="inline-flex items-center text-[13px] sm:text-[14px] bg-[#1e1e24] border border-white/10 text-white/90 px-3.5 py-1.5 rounded-full hover:bg-white hover:text-black transition-colors cursor-default"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: ACHIEVEMENTS */}
        <section
          id="achievements"
          className="py-24 sm:py-32 px-5 sm:px-8 md:px-12 max-w-7xl mx-auto border-b border-white/10"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-4">
            <div>
              <span className="text-[13px] uppercase tracking-widest text-orange-400 font-medium">
                04 / Recognition
              </span>
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-heading tracking-tight mt-3 text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Milestones &amp; Achievements
              </h2>
            </div>
            <p className="text-[15px] text-white/60 max-w-md">
              Track record of academic rigor, competitive hackathons, and
              certified machine learning knowledge.
            </p>
          </div>

          <div className="divide-y divide-white/10">
            {achievements.map((item, idx) => (
              <div
                key={idx}
                className="py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start group"
              >
                <div className="md:col-span-2 text-[14px] font-mono text-orange-400">
                  {item.year}
                </div>
                <div className="md:col-span-4">
                  <h3
                    className="text-xl sm:text-2xl font-heading font-semibold text-white group-hover:text-orange-300 transition-colors"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-[13px] uppercase tracking-wider text-white/50 mt-1">
                    {item.org}
                  </p>
                </div>
                <div className="md:col-span-6 text-[15px] sm:text-[16px] leading-relaxed text-white/75">
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: CONTACT */}
        <section
          id="contact"
          className="py-24 sm:py-32 px-5 sm:px-8 md:px-12 max-w-7xl mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-[13px] uppercase tracking-widest text-orange-400 font-medium">
                  05 / Connection
                </span>
                <h2
                  className="text-3xl sm:text-4xl lg:text-5xl font-heading tracking-tight mt-3 text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Let's engineer something memorable.
                </h2>
              </div>

              <p className="text-[17px] text-white/80 leading-relaxed">
                Currently open to{" "}
                <strong className="text-white font-semibold">
                  AI/ML Engineering roles
                </strong>
                ,{" "}
                <strong className="text-white font-semibold">
                  Full-Stack positions
                </strong>
                , and collaborative technical partnerships.
              </p>

              <div className="space-y-4 pt-4">
                <div className="p-4 rounded-xl border border-white/10 bg-[#141417] space-y-2">
                  <div className="text-[12px] uppercase tracking-wider text-white/50 font-medium">
                    Direct Email
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href="mailto:kasivishwanath0000@gmail.com"
                      className="text-[16px] sm:text-[18px] font-medium text-white underline underline-offset-2 hover:text-orange-300 transition-colors"
                    >
                      kasivishwanath0000@gmail.com
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="px-3 py-1 text-[12px] bg-white text-black font-medium rounded-full hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-[#141417] flex items-center justify-between">
                  <div>
                    <div className="text-[12px] uppercase tracking-wider text-white/50 font-medium">
                      Availability
                    </div>
                    <div className="text-[15px] font-medium text-white flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Immediate / Open for full-time offers
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="p-6 sm:p-10 rounded-2xl border border-white/10 bg-[#141417] shadow-xl">
                <h3
                  className="text-2xl font-heading font-semibold text-white mb-6"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Send a Direct Message
                </h3>

                {contactStatus === "sent" ? (
                  <div className="p-6 rounded-xl bg-white text-black space-y-2 text-center animate-fade-in">
                    <h4 className="text-xl font-heading font-semibold">
                      Message Dispatched!
                    </h4>
                    <p className="text-[14px] text-black/80">
                      Thank you for reaching out. I'll review your note and
                      respond back to you shortly.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div>
                      <label className="block text-[13px] uppercase tracking-wider text-white/60 font-medium mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={contactForm.name}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Ada Lovelace"
                        className="w-full px-4 py-3 rounded-lg border border-white/15 bg-[#1c1c20] text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] uppercase tracking-wider text-white/60 font-medium mb-1.5">
                        Your Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            email: e.target.value,
                          })
                        }
                        placeholder="ada@company.com"
                        className="w-full px-4 py-3 rounded-lg border border-white/15 bg-[#1c1c20] text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] uppercase tracking-wider text-white/60 font-medium mb-1.5">
                        Message / Project Brief
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) =>
                          setContactForm({
                            ...contactForm,
                            message: e.target.value,
                          })
                        }
                        placeholder="Tell me about the role, project goals, timeline, or technologies..."
                        className="w-full px-4 py-3 rounded-lg border border-white/15 bg-[#1c1c20] text-white placeholder:text-white/30 focus:outline-none focus:border-white transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={contactStatus === "submitting"}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white text-black text-[15px] font-semibold hover:bg-neutral-200 transition-colors cursor-pointer shadow-md active:scale-[0.99] disabled:opacity-50"
                    >
                      {contactStatus === "submitting"
                        ? "Transmitting message..."
                        : "Send Message →"}
                    </button>
                    <input
                      type="checkbox"
                      checked={botcheck}
                      onChange={(e) => setBotcheck(e.target.checked)}
                      style={{ display: "none" }}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                    {contactError && (
                      <p className="text-sm text-red-400">
                        Something went wrong. Email me directly at
                        kasivishwanath0000@gmail.com
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER in crisp white */}
        <footer className="border-t border-white/10 py-12 px-5 sm:px-8 md:px-12 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6 text-[14px] text-white/60">
          <div className="flex items-center gap-2">
            <span className="font-heading text-white font-semibold">
              Kasi Vishwanath®
            </span>
            <span>—</span>
            <span>MCA Student • AI/ML &amp; Full-Stack Developer</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-white hover:text-orange-300 underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0 font-inherit"
            >
              Back to top ↑
            </button>
            <span>•</span>
            <a
              href="mailto:kasivishwanath0000@gmail.com"
              className="text-white hover:text-orange-300 underline underline-offset-2 transition-colors"
            >
              kasivishwanath0000@gmail.com
            </a>
          </div>
        </footer>
      </div>

      {/* RESUME VIEWER MODAL */}
      {activeResumeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity"
          onClick={() => setActiveResumeModal(false)}
        >
          <div
            className="bg-[#141417] text-white w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-2xl shadow-2xl relative border border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/10">
              <div>
                <span className="text-[12px] uppercase tracking-wider text-orange-400 font-medium">
                  Curriculum Vitae
                </span>
                <h3
                  className="text-2xl font-heading tracking-tight mt-1 text-white font-semibold"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  B. Kasi Vishwanath
                </h3>
                <p className="text-[14px] text-white/60">
                  Master of Computer Applications • AI/ML &amp; Full-Stack
                  Developer
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveResumeModal(false)}
                className="text-white/60 hover:text-white p-1 text-2xl leading-none transition-colors cursor-pointer"
                aria-label="Close resume dialog"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 text-[14px] leading-relaxed text-white/80">
              <div>
                <h4 className="text-[12px] uppercase tracking-widest text-orange-400 font-semibold mb-2">
                  Executive Summary
                </h4>
                <p>
                  MCA student and software engineer with dedicated focus on
                  applied deep learning, computer vision, and scalable
                  full-stack web platforms. Proven experience delivering
                  sub-50ms inference pipelines, distributed logging
                  architectures, and user-centric web applications.
                </p>
              </div>

              <div>
                <h4 className="text-[12px] uppercase tracking-widest text-orange-400 font-semibold mb-2">
                  Education
                </h4>
                <div className="space-y-1">
                  <div className="font-semibold text-white">
                    Master of Computer Applications (MCA)
                  </div>
                  <div className="text-white/70">
                    Specialization: Artificial Intelligence, Data Engineering,
                    Software Architecture
                  </div>
                  <div className="text-[13px] text-white/50">
                    Graduation: 2026
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[12px] uppercase tracking-widest text-orange-400 font-semibold mb-2">
                  Key Projects &amp; Research
                </h4>
                <ul className="list-disc list-inside space-y-2 text-white/80">
                  <li>
                    <strong className="text-white">
                      AI Banking Fraud Detection:
                    </strong>{" "}
                    Hybrid XGBoost + Autoencoder anomaly detection system with
                    99.4% ROC-AUC and TreeSHAP compliance logging.
                  </li>
                  <li>
                    <strong className="text-white">PlantDoctor AI:</strong>{" "}
                    Mobile-first 38-class plant pathology classifier utilizing
                    quantized EfficientNet and ONNX Runtime for offline field
                    inference.
                  </li>
                  <li>
                    <strong className="text-white">
                      Log Monitoring Automation:
                    </strong>{" "}
                    Microservice incident triage tool leveraging sentence
                    embeddings for anomaly clustering, cutting triage time by
                    74%.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-[12px] uppercase tracking-widest text-orange-400 font-semibold mb-2">
                  Technical Stack
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Python",
                    "PyTorch",
                    "TensorFlow",
                    "FastAPI",
                    "React",
                    "TypeScript",
                    "Node.js",
                    "Docker",
                    "PostgreSQL",
                    "Redis",
                    "Kafka",
                    "Tailwind CSS",
                  ].map((tech) => (
                    <span
                      key={tech}
                      className="bg-white/10 text-white px-2.5 py-1 rounded text-[12px] border border-white/5"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 flex flex-wrap justify-between items-center gap-4">
              <span className="text-[13px] text-white/60">
                Contact: kasivishwanath0000@gmail.com
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-full border border-white/20 text-white text-[13px] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setActiveResumeModal(false)}
                  className="px-5 py-2 rounded-full bg-white text-black font-semibold text-[13px] hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
