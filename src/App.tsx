import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Copy, 
  Check, 
  Loader2, 
  LayoutDashboard, 
  Type as TypeIcon, 
  MousePointer2, 
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  History,
  Download,
  Trash2,
  Calendar,
  ExternalLink,
  AlertCircle,
  Monitor,
  Smartphone,
  CloudUpload,
  Rocket,
  MessageSquare,
  Briefcase,
  Zap,
  BookOpen,
  Sun,
  Moon,
  Globe,
  Settings,
  HelpCircle,
  Bell,
  ChevronRight,
  Layout,
  Target,
  BarChart3,
  X,
  LogOut,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateAdCampaign, AdCampaign } from './lib/gemini';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment,
  onSnapshot,
  User
} from './lib/firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Toaster, toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SavedCampaign extends AdCampaign {
  id: string;
  timestamp: number;
  businessName: string;
  tone?: string;
}

interface HeadlineItemProps {
  text: string;
  id: string;
  onCopy: (t: string, id: string) => void;
  copiedId: string | null;
}

const HeadlineItem: React.FC<HeadlineItemProps> = ({ text, id, onCopy, copiedId }) => {
  return (
    <div className="flex items-center justify-between group py-2.5 px-4 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700/50">
      <div className="flex items-center gap-4">
        <div className="w-5 h-5 flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-[9px] font-mono font-bold text-zinc-400 group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-colors">
          {id.split('-')[1]}
        </div>
        <span className="text-sm text-zinc-700 dark:text-zinc-300 font-semibold">{text}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className={cn(
            "text-[9px] font-black tracking-widest leading-none mb-0.5", 
            text.length > 30 ? "text-red-500" : "text-zinc-400"
          )}>
            {text.length}/30
          </span>
          <div className="h-0.5 w-8 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
             <div 
               className={cn("h-full transition-all", text.length > 30 ? "bg-red-500" : "bg-blue-600")} 
               style={{ width: `${Math.min(100, (text.length / 30) * 100)}%` }} 
             />
          </div>
        </div>
        <button
          onClick={() => onCopy(text, id)}
          className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md"
        >
          {copiedId === id ? <Check className="w-3.5 h-3.5 text-blue-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ isPro: boolean; generationCount: number; email: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('ad_gen_dark_mode');
    return saved ? JSON.parse(saved) : false;
  });
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [history, setHistory] = useState<SavedCampaign[]>(() => {
    const saved = localStorage.getItem('ad_gen_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [generationCount, setGenerationCount] = useState<number>(() => {
    const saved = localStorage.getItem('ad_gen_count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'history' | 'analytics'>('dashboard');
  const [userSettings, setUserSettings] = useState(() => {
    const saved = localStorage.getItem('ad_gen_settings');
    return saved ? JSON.parse(saved) : { geminiKey: '' };
  });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    audience: '',
    url: '',
    tone: 'Profesional'
  });
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [promoCode, setPromoCode] = useState('');
  
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setIsLoggedIn(true);
        setUser(currentUser);
        
        // Sync User Data
        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
          if (!docSnap.exists()) {
            const initialData = {
              email: currentUser.email || '',
              isPro: false,
              generationCount: 0,
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, initialData);
            setUserData(initialData as any);
          } else {
            setUserData(docSnap.data() as any);
          }
        });

        // Sync History (Optional: could use a limit)
        // For simplicity, we can load history here or on demand
        
        return () => unsubscribeUser();
      } else {
        setIsLoggedIn(false);
        setUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Berhasil masuk!');
    } catch (error) {
      toast.error('Gagal masuk. Silakan coba lagi.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Berhasil keluar');
    } catch (error) {
      toast.error('Gagal keluar');
    }
  };

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ad_gen_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  React.useEffect(() => {
    checkGoogleStatus();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
        toast.success('Google Ads connected successfully!');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkGoogleStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setIsGoogleConnected(data.connected);
    } catch (err) {
      console.error('Error checking Google status:', err);
    }
  };

  const connectGoogleAds = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get auth URL');
      }
      window.open(data.url, 'google_auth', 'width=600,height=700');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start Google connection');
    }
  };

  const publishToGoogleAds = async () => {
    if (!isGoogleConnected) {
      connectGoogleAds();
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch('/api/google-ads/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignData: {
            name: `AI Campaign - ${formData.name}`,
            // ... other data
          }
        })
      });
      
      if (!res.ok) throw new Error('Publish failed');
      
      toast.success('Campaign drafted in Google Ads!');
    } catch (err) {
      toast.error('Failed to publish to Google Ads. Check your API configuration.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExportCSV = () => {
    if (!campaign) return;

    // Helper to escape CSV values
    const escapeCSV = (str: string) => {
      if (!str) return '""';
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    let csvContent = "Category,Content,Details\n";
    
    // Keywords
    campaign.keywords.broad.forEach(k => csvContent += `Keyword,${escapeCSV(k)},Broad Match\n`);
    campaign.keywords.phrase.forEach(k => csvContent += `Keyword,${escapeCSV(k)},Phrase Match\n`);
    campaign.keywords.exact.forEach(k => csvContent += `Keyword,${escapeCSV(k)},Exact Match\n`);
    
    // Headlines
    campaign.headlines.forEach((h, i) => csvContent += `Headline,${escapeCSV(h)},Headline ${i+1}\n`);
    
    // Descriptions
    campaign.descriptions.forEach((d, i) => csvContent += `Description,${escapeCSV(d)},Description ${i+1}\n`);
    
    // Sitelinks
    campaign.sitelinks.forEach((s, i) => {
      csvContent += `Sitelink Title,${escapeCSV(s.title)},Sitelink ${i+1}\n`;
      csvContent += `Sitelink Desc,${escapeCSV(s.description)},Sitelink ${i+1}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `satset-ads-${formData.name.replace(/\s+/g, '-').toLowerCase() || 'campaign'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV berhasil diunduh!');
  };

  const tones = [
    { id: 'Santai', icon: MessageSquare, label: 'Santai', desc: 'Friendly & conversational' },
    { id: 'Profesional', icon: Briefcase, label: 'Profesional', desc: 'Business-like & trustworthy' },
    { id: 'Urgent', icon: Zap, label: 'Mendesak', desc: 'Creates FOMO & urgency' },
    { id: 'Bercerita', icon: BookOpen, label: 'Storytelling', desc: 'Narrative & engaging' }
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData) {
      toast.error('Mohon tunggu sebentar...');
      return;
    }

    if (!userData.isPro && userData.generationCount >= 1) {
      setShowUpgradeModal(true);
      return;
    }

    setLoading(true);
    setLoadingStep('Menganalisis bisnis Anda...');
    try {
      setTimeout(() => setLoadingStep('Mencari kata kunci berkinerja tinggi...'), 1500);
      setTimeout(() => setLoadingStep('Menyusun copy iklan persuasif...'), 3000);
      const result = await generateAdCampaign(formData, userSettings.geminiKey);
      setCampaign(result);
      
      const campaignId = Math.random().toString(36).substr(2, 9);
      const newCampaign: SavedCampaign = {
        ...result,
        id: campaignId,
        timestamp: Date.now(),
        businessName: formData.name,
        tone: formData.tone
      };

      // Save to Firebase
      if (user) {
        await setDoc(doc(db, 'campaigns', campaignId), {
          ...newCampaign,
          userId: user.uid
        });
        
        // Increment generation count
        await updateDoc(doc(db, 'users', user.uid), {
          generationCount: increment(1),
          updatedAt: new Date().toISOString()
        });
      }

      const newHistory = [newCampaign, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('ad_gen_history', JSON.stringify(newHistory));
      
      // Auto scroll to results
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      toast.error(error.message || 'Gagal membuat kampanye. Silakan coba lagi.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Disalin ke clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getUrlParts = (urlStr: string) => {
    try {
      if (!urlStr) return { hostname: 'www.bisnisanda.com', pathname: '' };
      const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      return {
        hostname: url.hostname,
        pathname: url.pathname === '/' ? '' : url.pathname.split('/').filter(Boolean).join(' › ')
      };
    } catch (e) {
      return { hostname: urlStr || 'www.bisnisanda.com', pathname: '' };
    }
  };

  const urlParts = getUrlParts(formData.url);

  const [timeLeft, setTimeLeft] = useState({ min: 14, sec: 59 });
  const [slotsLeft, setSlotsLeft] = useState(7);

  React.useEffect(() => {
    if (isLoggedIn) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.sec > 0) return { ...prev, sec: prev.sec - 1 };
        if (prev.min > 0) return { min: prev.min - 1, sec: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className={cn("min-h-screen bg-white dark:bg-zinc-950 selection:bg-blue-600 selection:text-white", darkMode && "dark")}>
        <Toaster position="top-center" theme={darkMode ? 'dark' : 'light'} />
        
        {/* Scarcity Banner */}
        <div className="bg-blue-600 py-1.5 sm:py-2 px-4 text-center sticky top-0 z-[70]">
          <p className="text-white text-[8px] sm:text-xs font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-4">
            <span className="hidden md:inline">⚡️ FLASH SALE: DISKON 90% UNTUK 100 PEMBELI PERTAMA</span>
            <span className="bg-white text-blue-600 px-1.5 py-0.5 rounded text-[9px] sm:text-xs">
              BERAKHIR DALAM {timeLeft.min}:{timeLeft.sec < 10 ? `0${timeLeft.sec}` : timeLeft.sec}
            </span>
            <span className="hidden md:inline">⚡️ SISA {slotsLeft} SLOT LAGI!</span>
            <span className="md:hidden">⚡️ DISKON 90% • {slotsLeft} SLOT LAGI!</span>
          </p>
        </div>

        {/* Nav */}
        <nav className="w-full z-50 px-4 sm:px-6 mt-4 sm:mt-8">
          <div className="max-w-7xl mx-auto h-16 sm:h-20 flex items-center justify-between border border-zinc-200 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/50 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg px-4 sm:px-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-base sm:text-xl font-display font-bold tracking-tight text-zinc-900 dark:text-white">SATSET.AI</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-6">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <button 
                onClick={handleLogin} 
                className="btn-primary py-2 px-4 sm:py-2.5 sm:px-6 text-xs sm:text-sm"
              >
                Mulai Sekarang
              </button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <main className="pt-12 sm:pt-24 pb-20">
          <div className="max-w-7xl mx-auto px-6 text-center space-y-8 sm:space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest"
            >
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
              AI-Powered Google Ads Generator
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="editorial-heading text-zinc-900 dark:text-white"
            >
              IKLAN JADI.<br />
              <span className="text-blue-600">SAT SET.</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-2xl mx-auto text-sm sm:text-lg md:text-xl text-zinc-500 dark:text-zinc-400 leading-relaxed px-4"
            >
              Bikin kampanye Google Ads profesional dalam hitungan detik. Riset keyword, headline, deskripsi, hingga sitelink • semua otomatis.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto px-4 sm:px-0">
                <button onClick={handleLogin} className="btn-primary w-full sm:w-auto">
                  Dapatkan Akses • 49k
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-zinc-950 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?u=${i}`} alt="User" referrerPolicy="no-referrer" />
                    </div>
                  ))}
                </div>
                <span>1,243 orang baru saja mendaftar hari ini</span>
              </div>
            </motion.div>

            {/* Preview Image */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="pt-12 sm:pt-20"
            >
              <div className="relative mx-auto max-w-5xl rounded-[24px] sm:rounded-[32px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-2 sm:p-4 shadow-2xl">
                <div className="absolute inset-0 bg-blue-600/5 blur-[60px] sm:blur-[120px] rounded-full" />
                <img 
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop" 
                  alt="Dashboard Preview" 
                  className="rounded-[18px] sm:rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-2xl opacity-90 dark:opacity-80"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>
        </main>

        {/* How it Works */}
        <section className="max-w-7xl mx-auto px-6 py-20 sm:py-32 border-t border-zinc-200 dark:border-zinc-800/50">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-12 sm:gap-20">
            {[
              { step: "01", title: "Input Bisnis", desc: "Masukkan nama, URL, dan deskripsi singkat produk Anda." },
              { step: "02", title: "AI Beraksi", desc: "Mesin kami menganalisis kompetitor dan mencari keyword terbaik." },
              { step: "03", title: "Iklan Siap", desc: "Salin copy iklan yang sudah dioptimasi langsung ke Google Ads." }
            ].map((s, i) => (
              <div key={i} className="space-y-6">
                <div className="text-5xl sm:text-6xl font-display font-bold text-zinc-200 dark:text-zinc-800">{s.step}</div>
                <h3 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-tight text-zinc-900 dark:text-white">{s.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-7xl mx-auto px-6 py-20 sm:py-32 border-t border-zinc-200 dark:border-zinc-800/50">
          <div className="text-center mb-16 sm:mb-20 space-y-4">
            <h2 className="text-3xl sm:text-5xl font-display font-bold uppercase tracking-tight text-zinc-900 dark:text-white">FITUR UNGGULAN.</h2>
            <p className="text-zinc-500 text-sm sm:text-lg">Segala yang Anda butuhkan untuk mendominasi Google Search.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Target, title: "Keyword Research", desc: "Temukan kata kunci dengan volume tinggi dan kompetisi rendah." },
              { icon: TypeIcon, title: "Headline Generator", desc: "15+ headline unik yang menarik klik lebih banyak." },
              { icon: MousePointer2, title: "Description Copy", desc: "Copywriting persuasif yang meningkatkan konversi." },
              { icon: LinkIcon, title: "Sitelink Ideas", desc: "Ekstensi iklan otomatis untuk memperluas jangkauan." },
              { icon: Zap, title: "Instant Result", desc: "Hanya butuh 10 detik untuk satu kampanye lengkap." },
              { icon: Globe, title: "Multi Language", desc: "Optimasi iklan dalam berbagai bahasa global." }
            ].map((f, i) => (
              <div key={i} className="glass-panel p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border-zinc-200 dark:border-zinc-800/50 hover:border-blue-600/30 transition-all group">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-50 dark:bg-zinc-900 rounded-xl sm:rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800 mb-6 group-hover:bg-blue-600 transition-colors">
                  <f.icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg sm:text-xl font-display font-bold uppercase tracking-tight mb-3 text-zinc-900 dark:text-white">{f.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 sm:py-32 border-t border-zinc-200 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-900/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 sm:gap-20 items-center">
              <div className="space-y-8 text-center lg:text-left">
                <h2 className="text-4xl sm:text-6xl font-display font-bold uppercase tracking-tighter leading-none text-zinc-900 dark:text-white">
                  APA KATA<br />
                  <span className="text-blue-600">MEREKA?</span>
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-base sm:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0">
                  Lebih dari 5,000+ pengiklan telah menggunakan SATSET.AI untuk menghemat waktu dan biaya agensi.
                </p>
                <div className="flex items-center justify-center lg:justify-start gap-4">
                  <div className="text-3xl sm:text-4xl font-display font-bold text-zinc-900 dark:text-white">4.9/5</div>
                  <div className="space-y-1 text-left">
                    <div className="flex text-blue-600">
                      {[1,2,3,4,5].map(i => <Sparkles key={i} className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />)}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Rating di G2 Crowd</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-6">
                {[
                  { name: "Andi Pratama", role: "Owner Coffee Shop", text: "Dulu pusing mikirin headline, sekarang tinggal klik langsung jadi. CTR naik 200%!", image: "https://picsum.photos/seed/andi/100/100" },
                  { name: "Siska Amelia", role: "Digital Marketer", text: "Alat wajib buat yang handle banyak klien. Riset keyword jadi super cepat.", image: "https://picsum.photos/seed/siska/100/100" }
                ].map((t, i) => (
                  <div key={i} className="glass-panel p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border-zinc-200 dark:border-zinc-800/50 space-y-4">
                    <p className="text-zinc-600 dark:text-zinc-300 text-sm sm:text-base italic leading-relaxed">"{t.text}"</p>
                    <div className="flex items-center gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                      <img src={t.image} alt={t.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-zinc-200 dark:border-zinc-800 object-cover" referrerPolicy="no-referrer" />
                      <div>
                        <div className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">{t.name}</div>
                        <div className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">{t.role}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="max-w-7xl mx-auto px-6 py-20 sm:py-32 border-t border-zinc-200 dark:border-zinc-800/50">
          <div className="text-center mb-16 sm:mb-20 space-y-4">
            <h2 className="text-3xl sm:text-5xl font-display font-bold uppercase tracking-tight text-zinc-900 dark:text-white">HARGA GILA.</h2>
            <p className="text-zinc-500 text-sm sm:text-lg">Investasi sekali, untung berkali-kali.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glass-panel p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] border-zinc-200 dark:border-zinc-800/50 space-y-8">
              <div className="space-y-2">
                <h3 className="text-base sm:text-xl font-bold uppercase tracking-widest text-zinc-400">Free Tier</h3>
                <div className="text-3xl sm:text-4xl font-display font-bold uppercase text-zinc-900 dark:text-white">Gratis</div>
              </div>
              <ul className="space-y-4">
                {['1x Generate Iklan', 'Riset Keyword Dasar', 'Pratinjau Mobile'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    <Check className="w-4 h-4 text-blue-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <button onClick={handleLogin} className="btn-secondary w-full">Mulai Gratis</button>
            </div>

            <div className="glass-panel p-8 sm:p-10 rounded-[32px] sm:rounded-[40px] border-blue-600/30 bg-blue-600/5 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 sm:px-6 py-1.5 sm:py-2 text-[8px] sm:text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
                PROMO TERBATAS
              </div>
              <div className="space-y-2">
                <h3 className="text-base sm:text-xl font-bold uppercase tracking-widest text-blue-600">Pro Lifetime</h3>
                <div className="flex flex-wrap items-baseline gap-3">
                  <div className="text-3xl sm:text-5xl font-display font-bold uppercase text-zinc-900 dark:text-white">49k</div>
                  <div className="text-base sm:text-xl text-zinc-400 line-through font-bold">499k</div>
                </div>
              </div>
              <ul className="space-y-4">
                {['Unlimited Generate', 'Riset Keyword Mendalam', 'Export CSV & Ads Editor', 'Dukungan Prioritas 24/7'].map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200">
                    <Check className="w-4 h-4 text-blue-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="space-y-4">
                <button onClick={handleLogin} className="btn-primary w-full shadow-blue-600/40">Ambil Promo Sekarang</button>
                <p className="text-[10px] text-center text-zinc-500 font-bold uppercase tracking-widest animate-pulse">
                  ⚠️ Hanya tersisa {slotsLeft} slot untuk harga ini!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="max-w-3xl mx-auto px-6 py-20 sm:py-32 border-t border-zinc-800/50">
          <div className="text-center mb-16 sm:mb-20 space-y-4">
            <h2 className="text-3xl sm:text-5xl font-display font-bold uppercase tracking-tight">TANYA JAWAB.</h2>
            <p className="text-zinc-500 text-sm sm:text-base">Hal-hal yang sering ditanyakan.</p>
          </div>
          <div className="space-y-4">
            {[
              { q: "Apakah ini berlangganan?", a: "Tidak. Promo 49k adalah akses seumur hidup (Lifetime Access) tanpa biaya bulanan." },
              { q: "Apakah aman untuk Google Ads?", a: "Sangat aman. AI kami mengikuti pedoman kebijakan Google Ads terbaru untuk memastikan iklan Anda disetujui." },
              { q: "Berapa lama proses generasinya?", a: "Kurang dari 10 detik. Anda akan mendapatkan keyword, headline, dan deskripsi secara instan." }
            ].map((item, i) => (
              <div key={i} className="glass-panel p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] border-zinc-800/50 space-y-3">
                <h4 className="text-base sm:text-lg font-bold font-display uppercase tracking-tight">{item.q}</h4>
                <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 sm:py-32 md:py-40 bg-blue-600">
          <div className="max-w-7xl mx-auto px-6 text-center space-y-8 sm:space-y-12">
            <h2 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-display font-bold text-white tracking-tighter leading-[0.9] uppercase">
              MULAI DOMINASI<br />
              GOOGLE ADS SEKARANG.
            </h2>
            <button onClick={() => setIsLoggedIn(true)} className="bg-white text-blue-600 text-sm sm:text-xl md:text-2xl font-bold px-6 py-3 sm:px-12 sm:py-6 md:px-16 md:py-8 rounded-full hover:scale-105 transition-transform flex items-center gap-3 sm:gap-4 mx-auto shadow-2xl">
              Dapatkan Akses Lifetime • 49k
              <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8" />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 sm:py-20 border-t border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 sm:gap-20">
            <div className="col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-display font-bold tracking-tight text-zinc-900 dark:text-white">SATSET.AI</span>
              </div>
              <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
                Platform AI tercanggih untuk membuat kampanye Google Ads yang berkonversi tinggi dalam hitungan detik.
              </p>
            </div>
            <div className="space-y-6">
              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Produk</h4>
              <ul className="space-y-4 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                <li><button className="hover:text-blue-600 transition-colors">Fitur</button></li>
                <li><button className="hover:text-blue-600 transition-colors">Harga</button></li>
                <li><button className="hover:text-blue-600 transition-colors">Demo</button></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Bantuan</h4>
              <ul className="space-y-4 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                <li><button className="hover:text-blue-600 transition-colors">FAQ</button></li>
                <li><button className="hover:text-blue-600 transition-colors">Kontak</button></li>
                <li><button className="hover:text-blue-600 transition-colors">Kebijakan</button></li>
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 pt-12 sm:pt-20 mt-12 sm:mt-20 border-t border-zinc-200 dark:border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">© 2024 SATSET.AI. All Rights Reserved.</p>
            <div className="flex items-center gap-6 text-zinc-400">
              <Globe className="w-4 h-4 hover:text-blue-600 transition-colors cursor-pointer" />
              <MessageSquare className="w-4 h-4 hover:text-blue-600 transition-colors cursor-pointer" />
              <Briefcase className="w-4 h-4 hover:text-blue-600 transition-colors cursor-pointer" />
            </div>
          </div>
        </footer>

        {/* Marquee */}
        <div className="py-10 border-y border-zinc-200 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-900/30 overflow-hidden">
          <div className="marquee-container">
            <div className="marquee-content flex gap-20 items-center">
              {[1, 2, 3, 4].map((i) => (
                <React.Fragment key={i}>
                  <span className="text-4xl font-display font-bold text-zinc-300 dark:text-zinc-700 uppercase tracking-tighter">Google Ads Optimized</span>
                  <Zap className="w-8 h-8 text-blue-600" />
                  <span className="text-4xl font-display font-bold text-zinc-300 dark:text-zinc-700 uppercase tracking-tighter">AI Copywriting</span>
                  <Sparkles className="w-8 h-8 text-blue-600" />
                  <span className="text-4xl font-display font-bold text-zinc-300 dark:text-zinc-700 uppercase tracking-tighter">Keyword Research</span>
                  <Target className="w-8 h-8 text-blue-600" />
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans selection:bg-blue-600 selection:text-white flex flex-col lg:flex-row", darkMode && "dark")}>
      <Toaster position="top-center" theme={darkMode ? 'dark' : 'light'} />
      
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-zinc-950/40 dark:bg-zinc-950/80 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 border-r border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 z-[70] flex flex-col transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:bg-zinc-50/50 dark:lg:bg-zinc-900/30",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-display font-bold tracking-tight text-zinc-900 dark:text-white">SATSET.AI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <button 
            onClick={() => {
              setActiveTab('dashboard');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
              activeTab === 'dashboard' ? "bg-blue-600/10 text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={connectGoogleAds}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm",
              isGoogleConnected 
                ? "bg-green-500/10 text-green-500" 
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <Globe className="w-5 h-5" />
            {isGoogleConnected ? 'Google Ads Connected' : 'Connect Google Ads'}
          </button>
          <button 
            onClick={() => {
              setActiveTab('history');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
              activeTab === 'history' ? "bg-blue-600/10 text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <History className="w-5 h-5" />
            Riwayat
          </button>
          <button 
            onClick={() => {
              setActiveTab('analytics');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
              activeTab === 'analytics' ? "bg-blue-600/10 text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <BarChart3 className="w-5 h-5" />
            Analytics
          </button>
          <button 
            onClick={() => {
              setActiveTab('settings');
              setIsSidebarOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all",
              activeTab === 'settings' ? "bg-blue-600/10 text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <Settings className="w-5 h-5" />
            Pengaturan
          </button>
        </nav>

        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800/50 space-y-6">
            <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700/50">
            {userData?.isPro ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-500">
                  <Zap className="w-4 h-4 fill-current" />
                  <span className="text-[10px] font-black uppercase tracking-widest">PRO Active</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-medium">Nikmati akses tanpa batas ke semua fitur SatSet.AI.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Free Plan</span>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{Math.max(0, 1 - (userData?.generationCount || 0))} Sisa</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(Math.max(0, 1 - (userData?.generationCount || 0)) / 1) * 100}%` }} />
                </div>
                <button onClick={() => setShowUpgradeModal(true)} className="w-full mt-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-500 transition-colors">
                  Upgrade Pro
                </button>
              </>
            )}
          </div>
          
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-zinc-500 hover:text-red-500 transition-colors font-bold text-sm">
            <LogOut className="w-5 h-5" />
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 sm:h-20 border-b border-zinc-200 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/50 backdrop-blur-xl px-4 sm:px-10 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-base sm:text-xl font-display font-bold text-zinc-900 dark:text-white">Dashboard</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
            <button className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors relative bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full border-2 border-white dark:border-zinc-950" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3 pl-4 sm:pl-6 border-l border-zinc-200 dark:border-zinc-800/50">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-zinc-900 dark:text-white truncate max-w-[100px]">{user?.displayName || 'User'}</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{userData?.isPro ? 'PRO Account' : 'Free Account'}</div>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" /> : (user?.email?.[0].toUpperCase() || 'U')}
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-10 space-y-6 sm:space-y-10">
          {activeTab === 'dashboard' ? (
            <div className="grid lg:grid-cols-12 gap-8 items-start">
              {/* Form Section */}
              <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-28">
                <div className="glass-panel p-6 sm:p-8 rounded-[32px] space-y-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-colors" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold font-display tracking-tight">Buat Iklan</h3>
                      <p className="text-xs text-zinc-500 font-medium">Input data produk Anda</p>
                    </div>
                  </div>

                  <form onSubmit={handleGenerate} className="space-y-6 relative z-10">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Bisnis / Produk</label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        placeholder="Contoh: Kopi Kenangan"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">URL Website</label>
                      <div className="flex items-center gap-3 w-full bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 transition-all focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-primary group/input">
                        <Globe className="w-4 h-4 text-zinc-500 group-focus-within/input:text-blue-500 transition-colors shrink-0" />
                        <input
                          type="url"
                          className="w-full bg-transparent py-3 outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm sm:text-base"
                          placeholder="https://www.bisnisanda.com"
                          value={formData.url}
                          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Deskripsi & Promo</label>
                      <textarea
                        required
                        rows={4}
                        className="input-field resize-none"
                        placeholder="Jelaskan keunggulan produk atau promo yang sedang berjalan..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Tone Iklan</label>
                      <div className="grid grid-cols-2 gap-3">
                        {tones.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, tone: t.id })}
                            className={cn(
                              "flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all relative overflow-hidden",
                              formData.tone === t.id
                                ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/25 scale-[1.02]"
                                : "bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            )}
                          >
                            <t.icon className={cn("w-5 h-5", formData.tone === t.id ? "text-white" : "text-blue-500")} />
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold block">{t.label}</span>
                              <span className={cn("text-[9px] font-medium leading-tight block opacity-60", formData.tone === t.id ? "text-white" : "text-zinc-500")}>
                                {t.desc}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full py-4 text-base relative overflow-hidden group/gen"
                    >
                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.div 
                            key="loading"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-3"
                          >
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">{loadingStep}</span>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="idle"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                            Generate Kampanye
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </form>
                </div>
              </div>

              {/* Results Section */}
              <div className="lg:col-span-8 space-y-8 pb-20">
                <AnimatePresence mode="wait">
                  {!campaign && !loading ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="h-full min-h-[600px] glass-panel rounded-[40px] flex flex-col items-center justify-center p-20 text-center space-y-8"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-600/20 blur-[100px] rounded-full animate-pulse" />
                        <div className="relative w-32 h-32 bg-zinc-100 dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                          <Rocket className="w-12 h-12 text-blue-500 animate-float" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-3xl font-display font-bold">Siap untuk Beriklan?</h3>
                        <p className="text-zinc-500 max-w-sm mx-auto leading-relaxed">
                          Isi detail bisnis Anda di samping untuk mulai membuat kampanye Google Ads yang dioptimalkan oleh AI.
                        </p>
                      </div>
                    </motion.div>
                  ) : loading ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full min-h-[600px] glass-panel rounded-[40px] flex flex-col items-center justify-center p-20 space-y-12"
                    >
                      <div className="relative w-24 h-24">
                        <div className="absolute inset-0 border-4 border-zinc-200 dark:border-zinc-800 rounded-full" />
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Zap className="w-8 h-8 text-blue-600 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center space-y-4">
                        <h3 className="text-2xl font-display font-bold uppercase tracking-tight">{loadingStep}</h3>
                        <div className="flex gap-2 justify-center">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                              className="w-2 h-2 bg-blue-600 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-10"
                    >
                      {/* Result Header */}
                      <div className="glass-panel p-6 sm:p-10 rounded-[40px] flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden group/header">
                        <div className="absolute inset-0 bg-blue-600/[0.02] dark:bg-blue-600/[0.05] opacity-0 group-hover/header:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-8 relative z-10">
                          <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-blue-600/30 transform group-hover/header:rotate-6 transition-transform">
                            <Zap className="w-10 h-10 text-white" />
                          </div>
                          <div className="space-y-1">
                            <h2 className="text-3xl font-display font-bold tracking-tight text-zinc-900 dark:text-white">{formData.name || 'Bisnis Anda'}</h2>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5 text-blue-500 text-sm font-bold bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                                <Globe className="w-3.5 h-3.5" />
                                {urlParts.hostname}
                              </span>
                              <span className="text-zinc-400 text-xs font-medium">• {formData.tone} Tone</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 relative z-10">
                          <button 
                            onClick={publishToGoogleAds}
                            disabled={isPublishing}
                            className="btn-primary py-3.5 px-8 bg-green-600 hover:bg-green-500 shadow-xl shadow-green-600/20 border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
                          >
                            {isPublishing ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <CloudUpload className="w-5 h-5" />
                            )}
                            <span className="text-sm font-black uppercase tracking-widest">
                              {isGoogleConnected ? 'Kirim ke Ads' : 'Hubungkan Google'}
                            </span>
                          </button>
                          <button 
                            onClick={handleExportCSV}
                            className="btn-secondary py-3.5 px-8 border-zinc-200 dark:border-zinc-800"
                          >
                            <Download className="w-5 h-5" />
                            <span className="text-sm font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Export CSV</span>
                          </button>
                        </div>
                      </div>

                      {/* Keywords Section */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                          <h3 className="text-xl font-display font-bold flex items-center gap-3">
                            <Target className="w-6 h-6 text-blue-500" />
                            AI KEYWORD RESEARCH
                          </h3>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6">
                          {(['broad', 'phrase', 'exact'] as const).map((type) => (
                            <div key={type} className="glass-panel p-8 rounded-[40px] space-y-6 group hover:border-blue-600/40 hover:shadow-xl hover:shadow-blue-600/5 transition-all flex flex-col min-h-[400px]">
                              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] block">
                                    {type === 'broad' ? 'Broad Match' : type === 'phrase' ? 'Phrase Match' : 'Exact Match'}
                                  </span>
                                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Best for {type === 'broad' ? 'Traffic' : type === 'phrase' ? 'Balanced' : 'High ROI'}</span>
                                </div>
                                <div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center font-mono text-[10px] font-bold text-zinc-400">
                                  {campaign.keywords[type].length}
                                </div>
                              </div>
                              <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] scrollbar-hide">
                                {campaign.keywords[type].map((kw, i) => (
                                  <div key={i} className="flex items-center justify-between group/item p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                    <span className="text-sm text-zinc-800 dark:text-zinc-300 font-semibold truncate pr-4">
                                      {type === 'phrase' ? `"${kw}"` : type === 'exact' ? `[${kw}]` : kw}
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(kw, `kw-${type}-${i}`)}
                                      className="p-2 opacity-0 group-hover/item:opacity-100 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg shrink-0"
                                    >
                                      {copiedId === `kw-${type}-${i}` ? <Check className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Headlines Section */}
                      <div className="glass-panel rounded-[40px] overflow-hidden border-zinc-200 dark:border-zinc-800/80 shadow-xl shadow-zinc-200/20 dark:shadow-none">
                        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                               <TypeIcon className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                              <h3 className="text-xl font-display font-bold tracking-tight">AI HEADLINES</h3>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-1">15 Headlines Generated for A/B Testing</p>
                            </div>
                          </div>
                          <div className="px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Performance Ready</span>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800/80 bg-zinc-50/30 dark:bg-transparent">
                          <div className="p-6 space-y-1">
                            {campaign.headlines.slice(0, 8).map((h, i) => (
                              <HeadlineItem key={i} text={h} id={`h-${i+1}`} onCopy={copyToClipboard} copiedId={copiedId} />
                            ))}
                          </div>
                          <div className="p-6 space-y-1">
                            {campaign.headlines.slice(8).map((h, i) => (
                              <HeadlineItem key={i+8} text={h} id={`h-${i+9}`} onCopy={copyToClipboard} copiedId={copiedId} />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Descriptions Section */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                          <h3 className="text-xl font-display font-bold flex items-center gap-3 text-zinc-900 dark:text-white">
                            <MousePointer2 className="w-6 h-6 text-blue-500" />
                            PERSUASIVE DESCRIPTIONS
                          </h3>
                        </div>
                        <div className="grid gap-6">
                          {campaign.descriptions.map((d, i) => (
                            <div key={i} className="glass-panel p-8 sm:p-10 rounded-[40px] flex flex-col sm:flex-row items-start justify-between gap-8 group hover:border-blue-600/40 hover:shadow-2xl hover:shadow-blue-600/5 transition-all relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 blur-2xl rounded-full -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="space-y-6 flex-1 pr-4 relative z-10">
                                <p className="text-xl text-zinc-800 dark:text-zinc-100 font-semibold leading-relaxed tracking-tight underline decoration-blue-500/30 decoration-4 underline-offset-8">
                                  {d}
                                </p>
                                <div className="flex items-center gap-6 pt-2">
                                  <div className="flex-1 max-w-[240px] space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className={cn("text-[9px] font-black uppercase tracking-widest", d.length > 90 ? "text-red-500" : "text-zinc-400")}>
                                        Character Limit
                                      </span>
                                      <span className={cn("text-[9px] font-black uppercase tracking-widest", d.length > 90 ? "text-red-500" : "text-zinc-500")}>
                                        {d.length}/90
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                      <div 
                                        className={cn("h-full rounded-full transition-all duration-1000", d.length > 90 ? "bg-red-500" : "bg-blue-600")} 
                                        style={{ width: `${Math.min(100, (d.length / 90) * 100)}%` }} 
                                      />
                                    </div>
                                  </div>
                                  <div className="h-8 w-[1px] bg-zinc-200 dark:border-zinc-800" />
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Quality Score</span>
                                    <div className="flex gap-0.5">
                                      {[1,2,3,4,5].map(star => (
                                        <div key={star} className={cn("w-1.5 h-1.5 rounded-full", star <= 4 ? "bg-google-green" : "bg-zinc-200 dark:bg-zinc-800")} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => copyToClipboard(d, `d-${i}`)}
                                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110 active:scale-95 group/btn"
                              >
                                {copiedId === `d-${i}` ? <Check className="w-5 h-5 text-blue-500 group-hover/btn:text-white" /> : <Copy className="w-5 h-5 text-zinc-400 group-hover/btn:text-white" />}
                                <span className="sm:hidden text-xs font-bold uppercase tracking-widest">Salin Deskripsi</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Preview Section */}
                      <div className="pt-20 space-y-12">
                        <div className="text-center space-y-4">
                          <h2 className="text-4xl font-display font-bold tracking-tight text-zinc-900 dark:text-white uppercase">AD PREVIEW.</h2>
                          <div className="flex items-center justify-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl w-fit mx-auto border border-zinc-200 dark:border-zinc-800 shadow-inner">
                            <button
                              onClick={() => setPreviewMode('desktop')}
                              className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all",
                                previewMode === 'desktop' ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-md shadow-zinc-200/50 dark:shadow-none translate-y-[-1px]" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                              )}
                            >
                              <Monitor className="w-4 h-4" />
                              Desktop
                            </button>
                            <button
                              onClick={() => setPreviewMode('mobile')}
                              className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all",
                                previewMode === 'mobile' ? "bg-white dark:bg-zinc-800 text-blue-600 shadow-md shadow-zinc-200/50 dark:shadow-none translate-y-[-1px]" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                              )}
                            >
                              <Smartphone className="w-4 h-4" />
                              Mobile
                            </button>
                          </div>
                        </div>

                        <motion.div 
                          layout
                          className={cn(
                            "mx-auto border border-zinc-200 dark:border-zinc-800 shadow-2xl relative transition-all duration-500 ease-in-out",
                            previewMode === 'desktop' 
                              ? "max-w-4xl bg-white dark:bg-zinc-950 p-12 rounded-[40px]" 
                              : "max-w-[340px] bg-white dark:bg-zinc-950 p-6 rounded-[50px] border-[10px] border-zinc-900 dark:border-zinc-800 min-h-[600px] shadow-[0_0_0_2px_rgba(255,255,255,0.05)_inset]"
                          )}
                        >
                          {/* Google Search Mockup */}
                          <div className="space-y-8">
                            {/* Ad Label & URL */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 px-1 rounded sm:px-1.5 leading-none">Disponsori</div>
                                <div className="google-ad-url text-sm flex items-center gap-1.5 opacity-80">
                                  {urlParts.hostname} {urlParts.pathname && <span className="text-zinc-400">› {urlParts.pathname}</span>}
                                </div>
                              </div>
                              <h4 className="google-ad-headline text-lg sm:text-xl font-medium cursor-pointer hover:underline transition-all">
                                {campaign.headlines[0]} | {campaign.headlines[1]} | {campaign.headlines[2]}
                              </h4>
                            </div>

                            {/* Description */}
                            <p className="google-ad-description text-sm leading-relaxed max-w-2xl">
                              {campaign.descriptions[0]}
                            </p>

                            {/* Sitelinks - Optimized for Ad Layout */}
                            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6 pt-2 border-t border-zinc-100 dark:border-zinc-900">
                              {campaign.sitelinks.slice(0, 4).map((s, i) => (
                                <div key={i} className="group cursor-pointer">
                                  <span className="google-ad-headline text-sm font-medium group-hover:underline block mb-0.5">{s.title}</span>
                                  <p className="google-ad-description text-[11px] sm:text-xs leading-snug opacity-70 group-hover:opacity-100 transition-opacity">{s.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Browser Deco for Desktop */}
                          {previewMode === 'desktop' && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-20">
                              <div className="w-2 h-2 rounded-full bg-zinc-400" />
                              <div className="w-2 h-2 rounded-full bg-zinc-400" />
                              <div className="w-2 h-2 rounded-full bg-zinc-400" />
                            </div>
                          )}
                        </motion.div>
                        
                        <div className="flex justify-center">
                          <p className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Check className="w-3.5 h-3.5" />
                            Visualisasi Iklan Real-time
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : activeTab === 'settings' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl space-y-8"
            >
              <div className="glass-panel p-10 rounded-[40px] space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-600/20">
                    <Settings className="w-7 h-7 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold font-display">Pengaturan API</h3>
                    <p className="text-sm text-zinc-500 font-medium">Konfigurasi kunci API Anda sendiri</p>
                  </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          Gemini API Key
                        </label>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:underline">Dapatkan Key Gratis</a>
                      </div>
                      <div className="flex items-center gap-3 w-full bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 transition-all focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-primary group/input">
                        <Zap className="w-4 h-4 text-zinc-400 group-focus-within/input:text-blue-500 transition-colors shrink-0" />
                        <input
                          type="password"
                          className="w-full bg-transparent py-3 outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm sm:text-base"
                          placeholder="Masukkan API Key Anda..."
                          value={userSettings.geminiKey}
                          onChange={(e) => {
                            const newSettings = { ...userSettings, geminiKey: e.target.value };
                            setUserSettings(newSettings);
                            localStorage.setItem('ad_gen_settings', JSON.stringify(newSettings));
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed italic px-1">
                        *Jika dikosongkan, aplikasi akan menggunakan API Key default sistem (kuota terbatas).
                      </p>
                    </div>

                  <div className="space-y-6 pt-6 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Globe className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Google Ads Configuration</span>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Developer Token</label>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="Dev Token..."
                          value={userSettings.devToken || ''}
                          onChange={(e) => {
                            const newSettings = { ...userSettings, devToken: e.target.value };
                            setUserSettings(newSettings);
                            localStorage.setItem('ad_gen_settings', JSON.stringify(newSettings));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Customer ID</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="123-456-7890"
                          value={userSettings.customerId || ''}
                          onChange={(e) => {
                            const newSettings = { ...userSettings, customerId: e.target.value };
                            setUserSettings(newSettings);
                            localStorage.setItem('ad_gen_settings', JSON.stringify(newSettings));
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-blue-600/5 border border-blue-600/20 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-blue-500">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">Informasi Keamanan</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      API Key dan Konfigurasi Anda disimpan secara lokal di browser Anda. Kami tidak pernah mengirimkan atau menyimpan data sensitif Anda di server kami.
                    </p>
                  </div>

                  <div className="p-8 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[32px] space-y-6">
                    <div className="flex items-center gap-3 text-zinc-900 dark:text-white">
                      <BookOpen className="w-5 h-5 text-blue-500" />
                      <h4 className="text-lg font-bold font-display">Tutorial Setup Google Ads</h4>
                    </div>
                    
                    <div className="space-y-6 text-sm">
                      <div className="space-y-3">
                        <p className="font-bold text-blue-500 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                          Dapatkan Kredensial OAuth
                        </p>
                        <ul className="list-disc list-inside text-zinc-500 dark:text-zinc-400 space-y-2 ml-7">
                          <li>Buka <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Google Cloud Console</a></li>
                          <li>Buat proyek baru & klik <b>"Create Credentials"</b> &gt; <b>"OAuth client ID"</b></li>
                          <li>Pilih tipe: <b>"Web application"</b></li>
                        </ul>
                      </div>

                      <div className="space-y-3">
                        <p className="font-bold text-blue-500 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                          Atur Redirect URIs
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 ml-7 mb-2">Tambahkan URL berikut di bagian <b>"Authorized Redirect URIs"</b>:</p>
                        <div className="ml-7 space-y-2">
                          <code className="block p-2 bg-zinc-200 dark:bg-zinc-800 rounded text-[10px] break-all select-all">
                            {window.location.origin}/auth/google/callback
                          </code>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="font-bold text-blue-500 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                          Input ke Pengaturan
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 ml-7">
                          Salin <b>Client ID</b> dan <b>Client Secret</b> ke form di atas. Jangan lupa isi <b>Developer Token</b> dari dashboard Google Ads Anda.
                        </p>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Penting:</p>
                        <p className="text-xs text-zinc-500">
                          Pastikan Anda juga telah mengaktifkan <b>Google Ads API</b> di Google Cloud Library agar aplikasi bisa membuat kampanye secara otomatis.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'history' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-display font-bold">Riwayat Kampanye</h3>
                <button 
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem('ad_gen_history');
                    toast.success('Riwayat dihapus');
                  }}
                  className="text-xs font-bold text-red-500 hover:underline uppercase tracking-widest"
                >
                  Hapus Semua
                </button>
              </div>
              
              {history.length === 0 ? (
                <div className="glass-panel p-20 rounded-[40px] text-center space-y-4">
                  <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <History className="w-10 h-10 text-zinc-400 dark:text-zinc-600" />
                  </div>
                  <h4 className="text-xl font-bold text-zinc-900 dark:text-white">Belum ada riwayat</h4>
                  <p className="text-zinc-500">Kampanye yang Anda buat akan muncul di sini.</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {history.map((h) => (
                    <div key={h.id} className="glass-panel p-8 rounded-[32px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 group hover:border-blue-600/30 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800 group-hover:bg-blue-600/10 transition-colors">
                          <Rocket className="w-8 h-8 text-blue-500" />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-zinc-900 dark:text-white">{h.businessName}</h4>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-medium mt-1">
                            <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                              <Globe className="w-3.5 h-3.5" /> {h.url}
                            </span>
                            <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                              <Zap className="w-3.5 h-3.5 text-blue-500" /> {h.tone}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> {new Date(h.timestamp || 0).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button 
                          onClick={() => {
                            setCampaign(h);
                            setActiveTab('dashboard');
                          }}
                          className="btn-primary py-2.5 px-6 text-xs flex-1 sm:flex-none"
                        >
                          Buka Kampanye
                        </button>
                        <button 
                          onClick={() => {
                            const newHistory = history.filter(item => item.id !== h.id);
                            setHistory(newHistory);
                            localStorage.setItem('ad_gen_history', JSON.stringify(newHistory));
                            toast.success('Dihapus dari riwayat');
                          }}
                          className="p-2.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <h3 className="text-3xl font-display font-bold">Analytics</h3>
              <div className="grid sm:grid-cols-3 gap-6">
                {[
                      {label: 'Total Generasi', value: userData?.generationCount || 0, icon: Sparkles, color: 'text-blue-500'},
                      {label: 'Kampanye Aktif', value: history.length, icon: Rocket, color: 'text-green-500'},
                      {label: 'Sisa Kuota', value: userData?.isPro ? '∞' : Math.max(0, 1 - (userData?.generationCount || 0)), icon: Zap, color: 'text-yellow-500'}
                ].map((stat, i) => (
                  <div key={i} className="glass-panel p-8 rounded-[32px] space-y-4">
                    <div className="flex items-center justify-between">
                      <stat.icon className={cn("w-6 h-6", stat.color)} />
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Live Data</span>
                    </div>
                    <div>
                      <div className="text-3xl font-display font-bold">{stat.value}</div>
                      <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{stat.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="glass-panel p-20 rounded-[40px] text-center space-y-4">
                <BarChart3 className="w-16 h-16 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
                <h4 className="text-xl font-bold text-zinc-900 dark:text-white">Grafik Performa Segera Hadir</h4>
                <p className="text-zinc-500 max-w-sm mx-auto">Hubungkan akun Google Ads Anda untuk melihat data performa iklan secara real-time di sini.</p>
                <button onClick={connectGoogleAds} className="btn-primary mt-6">Hubungkan Sekarang</button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpgradeModal(false)}
              className="absolute inset-0 bg-zinc-950/40 dark:bg-zinc-950/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl glass-panel rounded-[48px] overflow-hidden shadow-2xl"
            >
              <div className="p-12 text-center space-y-10">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-blue-600/20 blur-2xl rounded-full animate-pulse" />
                    <Zap className="w-10 h-10 text-blue-600 relative z-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-display font-bold uppercase tracking-tight text-zinc-900 dark:text-white">Upgrade ke PRO</h3>
                    <p className="text-zinc-500 dark:text-zinc-400">Buka potensi penuh bisnis Anda dengan fitur tanpa batas.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left">
                  {[
                    "Generasi Tanpa Batas",
                    "Riset Keyword Real-time",
                    "Export CSV & Google Ads",
                    "Dukungan Prioritas 24/7",
                    "Tone Iklan Kustom",
                    "Analisis Kompetitor"
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      <Check className="w-4 h-4 text-blue-600" />
                      {f}
                    </div>
                  ))}
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Punya Kode Aktivasi?</label>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="Masukkan kode..." 
                        className="input-field text-center font-mono tracking-widest"
                      />
                      <button 
                        onClick={async () => {
                          if (!user) return;
                          try {
                            const res = await fetch('/api/pro/activate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ code: promoCode })
                            });
                            const data = await res.json();
                            if (data.success) {
                              const userRef = doc(db, 'users', user.uid);
                              await updateDoc(userRef, {
                                isPro: true,
                                updatedAt: new Date().toISOString()
                              });
                              setShowUpgradeModal(false);
                              toast.success('Selamat! Akun PRO Berhasil Diaktifkan');
                            } else {
                              toast.error('Kode tidak valid');
                            }
                          } catch (err) {
                            toast.error('Terjadi kesalahan. Coba lagi.');
                          }
                        }}
                        className="px-6 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all shrink-0"
                      >
                        Aktifkan
                      </button>
                    </div>
                  </div>

                  <a 
                    href="https://wa.me/6282141396879?text=Halo%20Gan,%20saya%20mau%20beli%20kode%20aktivasi%20SatSet.AI%20PRO"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary w-full py-5 text-lg bg-green-600 hover:bg-green-500 shadow-green-600/20"
                  >
                    <MessageSquare className="w-6 h-6" />
                    Beli Kode via WA • 49k
                  </a>
                  <button onClick={() => setShowUpgradeModal(false)} className="w-full py-2 text-zinc-500 font-bold hover:text-zinc-900 dark:hover:text-white transition-colors text-xs uppercase tracking-widest">Mungkin Nanti</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
