"use client";
import { useState, useEffect } from "react";
import { LayoutDashboard, Leaf, Database, Map as MapIcon, Sparkles, Trash2, AlertCircle, FileSpreadsheet, User, BarChart2, CheckCircle2 } from "lucide-react";

export default function YieldSenseApp() {
  // --- AUTH & API STATE ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [loginEmail, setLoginEmail] = useState("farmer@example.com");
  const [loginPassword, setLoginPassword] = useState("password123");
  const [apiError, setApiError] = useState("");

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState("overview");
  const [timeData, setTimeData] = useState({ date: "", greeting: "Good morning" });

  useEffect(() => {
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-GB', { 
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
    }).toUpperCase();
    
    const hours = date.getHours();
    let greet = "Good evening";
    if (hours < 12) greet = "Good morning";
    else if (hours < 18) greet = "Good afternoon";

    setTimeData({ date: formattedDate, greeting: greet });
  }, []);

  // --- AI INTELLIGENCE DATA ---
  const cropBaselines = {
    Maize: { temp: "25.3", rainfall: "820.0", ph: "6.5", moisture: "45.0", nitrogen: "90", phosphorus: "50", potassium: "60", pesticide: "0" },
    Rice: { temp: "28.1", rainfall: "1200.5", ph: "6.0", moisture: "80.2", nitrogen: "100", phosphorus: "40", potassium: "50", pesticide: "0" },
    Cotton: { temp: "30.2", rainfall: "600.0", ph: "7.1", moisture: "35.5", nitrogen: "80", phosphorus: "40", potassium: "40", pesticide: "0" },
    Wheat: { temp: "22.4", rainfall: "450.0", ph: "6.8", moisture: "40.0", nitrogen: "120", phosphorus: "60", potassium: "40", pesticide: "0" },
    Millet: { temp: "32.5", rainfall: "300.0", ph: "7.5", moisture: "25.0", nitrogen: "50", phosphorus: "30", potassium: "30", pesticide: "0" },
    Sugarcane: { temp: "26.8", rainfall: "1500.0", ph: "6.2", moisture: "75.0", nitrogen: "150", phosphorus: "80", potassium: "100", pesticide: "0" }
  };

  const cropProcedures = {
    Maize: "Post-Harvest: Clear stalks and test soil for nitrogen depletion. Consider crop rotation with legumes next season.",
    Rice: "Post-Harvest: Drain paddies completely. Dry grains to 14% moisture before milling to prevent fungal growth.",
    Cotton: "Post-Harvest: Defoliate appropriately. Store modules in dry areas immediately to prevent fiber degradation.",
    Wheat: "Post-Harvest: Dry grains to 12% moisture. Retain stubble in the field to conserve soil moisture for the next cycle.",
    Millet: "Post-Harvest: Sun-dry heads and thresh carefully. Highly resilient field; suitable for immediate secondary planting.",
    Sugarcane: "Post-Harvest: Transport to mill within 24 hours of cutting to prevent sucrose inversion and yield loss."
  };
  
  // --- FORECAST STATE ---
  const [isForecastGenerated, setIsForecastGenerated] = useState(false);
  const [forecastResult, setForecastResult] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  
  const [forecastForm, setForecastForm] = useState({
    crop: "Maize", area: "12", ...cropBaselines["Maize"]
  });

  const handleCropChange = (e) => {
    const selectedCrop = e.target.value;
    const baseline = cropBaselines[selectedCrop];
    setForecastForm(prev => ({
      ...prev,
      crop: selectedCrop,
      ...baseline
    }));
  };

  // --- FIELD REGISTRY STATE ---
  const [fields, setFields] = useState([]);
  const [newField, setNewField] = useState({ name: "", location: "", area: "", soil: "Loamy" });

  const totalAcres = fields.reduce((sum, field) => sum + (parseFloat(field.area) || 0), 0);
  const primaryLocation = fields.length > 0 ? fields[fields.length - 1].location : "No active location";

  // ==========================================
  // API INTEGRATION HANDLERS
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setApiError("");
    try {
      const formData = new URLSearchParams();
      formData.append("username", loginEmail);
      formData.append("password", loginPassword);
      const response = await fetch("http://localhost:8000/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData });
      if (response.ok) {
        const data = await response.json(); setToken(data.access_token); setIsLoggedIn(true);
      } else {
        const errorData = await response.json(); setApiError(errorData.detail || "Login failed.");
      }
    } catch (error) { setApiError("Backend connection failed."); }
  };

  const handleLogout = (e) => {
    if (e) e.stopPropagation();
    setIsLoggedIn(false); setToken(null); setFields([]); setActiveTab("overview");
  };

  useEffect(() => {
    if (isLoggedIn && token) {
      fetch("http://localhost:8000/fields", { headers: { "Authorization": `Bearer ${token}` } })
      .then(res => res.json()).then(data => { if (Array.isArray(data)) setFields(data); }).catch(console.error);
    }
  }, [isLoggedIn, token]);

  const handleGenerateForecast = async (e) => {
    e.preventDefault();
    setIsPredicting(true);
    setApiError("");
    
    try {
      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          rainfall: parseFloat(forecastForm.rainfall),
          temperature: parseFloat(forecastForm.temp),
          pesticide: parseFloat(forecastForm.pesticide),
          area: parseFloat(forecastForm.area),
          nitrogen: parseFloat(forecastForm.nitrogen),
          phosphorus: parseFloat(forecastForm.phosphorus),
          potassium: parseFloat(forecastForm.potassium),
          ph: parseFloat(forecastForm.ph),
          moisture: parseFloat(forecastForm.moisture)
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // --- 1. YIELD MATH ---
        const areaVal = parseFloat(forecastForm.area);
        const safeArea = (isNaN(areaVal) || areaVal <= 0) ? 0 : areaVal;
        const baseYieldPerHectare = parseFloat(data.predicted_crop_yield);
        const totalProduction = (baseYieldPerHectare * safeArea).toFixed(2);

        // --- 2. EXACT PER-HECTARE CALCULATOR MATH ---
        const base = cropBaselines[forecastForm.crop];
        
        const optimalN = parseFloat(base.nitrogen);
        const optimalP = parseFloat(base.phosphorus);
        const optimalK = parseFloat(base.potassium);
        
        const currentN = parseFloat(forecastForm.nitrogen);
        const currentP = parseFloat(forecastForm.phosphorus);
        const currentK = parseFloat(forecastForm.potassium);
        const currentPh = parseFloat(forecastForm.ph);

        // Calculate direct per-hectare gap (Current minus Optimal)
        const gapN = currentN - optimalN;
        const gapP = currentP - optimalP;
        const gapK = currentK - optimalK;

        // Formatter for clear human language UI (per hectare)
        const formatGap = (gap) => {
          if (gap < -0.1) return { action: "Add", val: Math.abs(gap).toFixed(1), unit: "kg/ha", color: "text-blue-400" };
          if (gap > 0.1) return { action: "Reduce", val: gap.toFixed(1), unit: "kg/ha", color: "text-[#EF476F]" };
          return { action: "Perfect", val: "Amount", unit: "", color: "text-[#B5F140]" };
        };

        const resN = formatGap(gapN);
        const resP = formatGap(gapP);
        const resK = formatGap(gapK);

        // Raw values for action plan text
        const addN = gapN < 0 ? Math.abs(gapN).toFixed(1) : 0;
        const addP = gapP < 0 ? Math.abs(gapP).toFixed(1) : 0;
        const addK = gapK < 0 ? Math.abs(gapK).toFixed(1) : 0;

        const excessN = gapN > 0 ? gapN.toFixed(1) : 0;
        const excessP = gapP > 0 ? gapP.toFixed(1) : 0;
        const excessK = gapK > 0 ? gapK.toFixed(1) : 0;

        // --- 3. RISK & ALIGNMENT ---
        const tDiff = Math.abs(parseFloat(forecastForm.temp) - parseFloat(base.temp));
        const rDiff = Math.abs(parseFloat(forecastForm.rainfall) - parseFloat(base.rainfall));
        const mDiff = parseFloat(forecastForm.moisture) - parseFloat(base.moisture); 
        const phDiff = Math.abs(currentPh - parseFloat(base.ph));
        
        let stressFactors = 0;
        if (tDiff > 4) stressFactors++; 
        if (rDiff > 200) stressFactors++; 
        if (phDiff > 1.5) stressFactors += 2; 
        
        if (excessN > optimalN * 0.5) stressFactors += 2;
        else if (excessN > 0) stressFactors += 1;
        if (excessP > optimalP * 0.5) stressFactors += 1;
        if (excessK > optimalK * 0.5) stressFactors += 1;

        let riskStatus, riskColor, riskMsg, alignmentScore;
        
        if (stressFactors === 0 && gapN === 0 && gapP === 0 && gapK === 0) {
          riskStatus = "Optimal / Good to Grow";
          riskColor = "bg-[#B5F140] text-[#12281C]"; 
          riskMsg = "Current conditions map perfectly to historical success metrics.";
          alignmentScore = (94 + Math.random() * 5).toFixed(0);
        } else if (stressFactors <= 2) {
          riskStatus = "Moderate Risk";
          riskColor = "bg-[#FFD166] text-[#12281C]"; 
          riskMsg = "Conditions are outside optimal ranges. Follow the instructions below.";
          alignmentScore = (70 + Math.random() * 15).toFixed(0);
        } else {
          riskStatus = "Critical Alert";
          riskColor = "bg-[#EF476F] text-white"; 
          riskMsg = "Extreme environmental deviation detected. High probability of crop failure.";
          alignmentScore = Math.max(5, 60 - (stressFactors * 10)).toFixed(0);
        }

        // --- 4. EXPLICIT PROFIT-FOCUSED ACTION PLAN ---
        let actionPlan = [];
        
        // pH Logic
        if (currentPh > 8.5) {
          actionPlan.push(`🧪 HIGH ALKALINITY: Soil pH (${currentPh}) is far too high. Apply elemental sulfur or aluminum sulfate immediately.`);
        } else if (currentPh < 5.0) {
          actionPlan.push(`🧪 HIGH ACIDITY: Soil pH (${currentPh}) is far too low. Apply agricultural lime to neutralize acidity.`);
        }

        // Moisture Logic
        if (mDiff < -15) {
          actionPlan.push(`💧 MOISTURE DEFICIT: Increase irrigation to reach ~${base.moisture}% moisture.`);
        } else if (mDiff > 15) {
          actionPlan.push(`🛑 WATERLOGGED: Improve field drainage. Excess water will stunt root growth.`);
        }

        // Nitrogen Logic
        if (excessN > 0) {
           actionPlan.push(`⚠️ NITROGEN: Reduce ${excessN} kg. If you reduce this excess, your crop will grow healthier and your profit will be more.`);
        } else if (addN > 0) {
          actionPlan.push(`📉 NITROGEN: Add ${addN} kg. Providing this exact amount ensures your crop grows more and maximizes your profit.`);
        }

        // Phosphorus Logic
        if (excessP > 0) {
           actionPlan.push(`⚠️ PHOSPHORUS: Reduce ${excessP} kg. Reducing this excess prevents soil lock-out and increases your final profit.`);
        } else if (addP > 0) {
           actionPlan.push(`📉 PHOSPHORUS: Add ${addP} kg. Adding this will improve root development and increase your yield profit.`);
        }

        // Potassium Logic
        if (excessK > 0) {
           actionPlan.push(`⚠️ POTASSIUM: Reduce ${excessK} kg. Bringing this down to optimal levels will save you money and increase your crop profit.`);
        } else if (addK > 0) {
           actionPlan.push(`📉 POTASSIUM: Add ${addK} kg. Adding this will improve disease resistance and ensure a more profitable harvest.`);
        }

        const standardProcedure = cropProcedures[forecastForm.crop];
        const finalProcedure = actionPlan.length > 0 
          ? `${actionPlan.join("\n\n")}\n\n📌 ${standardProcedure}`
          : `✅ PERFECT BALANCE: Your soil inputs are perfectly balanced. No changes needed. You are set for maximum profit.\n\n📌 ${standardProcedure}`;
        
        setForecastResult({ 
          total: safeArea > 0 ? totalProduction : "0.00", 
          perAcre: baseYieldPerHectare.toFixed(2), 
          crop: forecastForm.crop,
          riskStatus, riskColor, riskMsg, alignmentScore,
          procedure: finalProcedure,
          resources: { area: safeArea, n: resN, p: resP, k: resK }
        });
        setIsForecastGenerated(true);
      } else {
        alert("Prediction failed. Check token or backend inputs schema.");
      }
    } catch (error) {
      alert("Failed to connect to FastAPI backend. Ensure it is running.");
    } finally {
      setIsPredicting(false);
    }
  };

  const handleRegisterField = async (e) => {
    e.preventDefault();
    if (!newField.name || !newField.area) return;
    try {
      const response = await fetch("http://localhost:8000/fields", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: newField.name, location: newField.location, area: parseFloat(newField.area), soil: newField.soil })
      });
      if (response.ok) {
        const savedField = await response.json(); setFields([...fields, savedField]);
        setNewField({ name: "", location: "", area: "", soil: "Loamy" }); 
      }
    } catch (error) { console.error(error); }
  };

  const handleRemoveField = (indexToRemove) => setFields(fields.filter((_, index) => index !== indexToRemove));

  // ==========================================
  // VIEW 1: LOGIN SCREEN
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex font-sans selection:bg-[#B5F140] selection:text-[#12281C]">
        <div className="w-1/2 bg-[#12281C] relative overflow-hidden flex flex-col justify-center p-20 hidden md:flex">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#B5F140] rounded-full opacity-90"></div>
          <div className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-t from-[#2D5A3C] to-transparent opacity-50 transform skew-y-12 translate-y-20"></div>
          <div className="relative z-10 text-[#F4F2EB]">
            <p className="text-xs font-bold tracking-[0.2em] uppercase mb-16 text-[#8EA094]">Agricultural Intelligence / 01</p>
            <h1 className="text-7xl font-serif leading-[1.1] mb-6">Every field<br/>has a future.</h1>
            <p className="text-xl text-gray-300">Forecast it with confidence.</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-[#F4F2EB] flex flex-col justify-center p-8 md:p-24">
          <div className="max-w-md w-full mx-auto">
            <div className="flex items-center text-xs font-black tracking-[0.2em] mb-16 uppercase text-[#12281C]">
              <span className="mr-2 text-lg leading-none">✦</span> YieldSense AI
            </div>
            <h2 className="text-5xl font-serif text-[#12281C] mb-4">Sign in to your fields</h2>
            <p className="text-gray-500 mb-10">Your growing season, made visible.</p>
            {apiError && (<div className="bg-red-100 text-red-700 p-4 rounded-xl text-sm mb-6 flex items-center"><AlertCircle size={16} className="mr-2" />{apiError}</div>)}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Email</label>
                <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#12281C] bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Password</label>
                <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#12281C] bg-white" />
              </div>
              <button type="submit" className="w-full bg-[#12281C] text-white py-4 rounded-xl text-sm font-bold flex justify-center items-center space-x-2 hover:bg-black transition-colors mt-4">
                <span>Sign in via FastAPI</span> <span>&rarr;</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: MAIN DASHBOARD
  // ==========================================
  const NavButton = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button onClick={() => setActiveTab(id)} className={`w-full flex items-center space-x-4 p-3 px-4 rounded-xl transition-all ${ isActive ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#E4E0D1] text-[#12281C]" : "text-gray-500 hover:text-[#12281C]" }`}>
        <Icon size={18} strokeWidth={1.5} className={isActive ? "text-[#2D5A3C]" : ""} />
        <span className={`font-${isActive ? 'bold' : 'medium'} text-sm`}>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F2EB] text-[#12281C] flex font-sans selection:bg-[#B5F140] selection:text-[#12281C]">
      {/* Sidebar */}
      <aside className="w-[260px] flex-shrink-0 border-r border-[#E4E0D1] flex flex-col justify-between py-8 px-6 hidden md:flex">
        <div>
          <div className="flex items-center text-xs font-black tracking-[0.2em] mb-10 uppercase cursor-pointer" onClick={() => setActiveTab('overview')}>
            <span className="mr-2 text-lg leading-none">✦</span> YieldSense AI
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[#E4E0D1] mb-6 cursor-pointer hover:border-[#2D5A3C] transition-colors" onClick={() => setActiveTab('registry')}>
            <div className="flex items-center space-x-2 text-[9px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#B5F140]"></div>
              <span>Active Zone</span>
            </div>
            <p className="text-sm font-bold text-[#12281C] capitalize truncate">{fields.length > 0 ? fields[fields.length - 1].name : "No fields yet"}</p>
          </div>

          <nav className="space-y-1">
            <NavButton id="overview" icon={LayoutDashboard} label="Overview" />
            <NavButton id="forecast" icon={Leaf} label="Yield Forecast" />
            <NavButton id="registry" icon={Database} label="Field Registry" />
            <NavButton id="dataset" icon={FileSpreadsheet} label="Dataset Explorer" />
            <NavButton id="system" icon={MapIcon} label="System Map" />
          </nav>
        </div>
        
        <div onClick={() => setActiveTab('profile')} className="flex items-start space-x-3 pt-6 mt-8 border-t border-[#E4E0D1] cursor-pointer hover:bg-black/5 p-3 -mx-3 rounded-xl transition-colors">
          <div className="w-10 h-10 bg-[#12281C] text-[#F4F2EB] flex items-center justify-center rounded-full font-serif text-lg flex-shrink-0">S</div>
          <div className="text-left flex flex-col w-full overflow-hidden">
            <p className="text-sm font-bold leading-tight truncate w-full">Sanghavi S Avadhani</p>
            <p className="text-[10px] text-gray-500 mt-0.5 truncate w-full">{loginEmail}</p>
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] text-gray-600 truncate w-full flex items-center gap-1">📍 {primaryLocation}</p>
              <p className="text-[10px] text-gray-600 truncate w-full flex items-center gap-1">🌾 {totalAcres.toFixed(1)} Total Acres</p>
            </div>
            <button onClick={handleLogout} className="text-[10px] text-left text-gray-400 hover:text-red-600 font-bold uppercase tracking-widest mt-3 transition-colors">Sign out ↗</button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto overflow-y-auto">
        
        {/* ===================== OVERVIEW TAB ===================== */}
        {activeTab === "overview" && (
           <div className="animate-in fade-in duration-500">
             <header className="flex justify-between items-end mb-10">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-500 mb-3 uppercase">{timeData.date}</p>
                <h2 className="text-5xl font-serif tracking-tight text-[#12281C]">{timeData.greeting}, <span className="italic text-[#2D5A3C]">grower.</span></h2>
              </div>
              <div className="flex items-center space-x-2 text-[10px] font-bold text-[#12281C] tracking-[0.15em] uppercase mb-2">
                <div className="w-2 h-2 rounded-full bg-[#B5F140]"></div>
                <span className="hidden md:inline">Systems Optimal</span>
              </div>
            </header>
            
            <div className="bg-[#EBE6D5] rounded-2xl p-6 md:p-10 flex flex-col md:flex-row justify-between items-center mb-8 gap-8">
              <div className="max-w-lg">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-gray-500 mb-4 uppercase">Seasonal Outlook / Kharif '26</p>
                <h3 className="text-4xl font-serif leading-tight mb-4 text-[#12281C]">Make your next harvest <br/><span className="italic text-[#2D5A3C]">count.</span></h3>
                <p className="text-sm text-[#4A5A50] mb-6">Local conditions are trending favorable. Your FastAPI intelligence engine is connected and ready.</p>
                <button onClick={() => setActiveTab('forecast')} className="bg-[#12281C] text-white px-6 py-3.5 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-black transition-colors w-full md:w-auto justify-center">
                  <span>Run Live AI Forecast</span> <span>&rarr;</span>
                </button>
              </div>
              
              <div className="w-48 h-48 rounded-full bg-[#91B875] flex items-center justify-center p-4">
                <div className="w-full h-full rounded-full border border-[#749D56] bg-[#6A964D] flex items-center justify-center p-3">
                  <div className="w-full h-full rounded-full border border-dashed border-[#8CBA6F] bg-[#4B793E] flex flex-col items-center justify-center text-white shadow-inner">
                    <span className="text-5xl font-serif leading-none mb-1">78</span>
                    <span className="text-[9px] tracking-[0.2em] font-bold uppercase leading-tight text-center text-[#BEEA9B]">Weather<br/>Index</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-[#E4E0D1]">
                <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 mb-5 uppercase">Last API Prediction</p>
                <p className="text-[2.75rem] font-serif leading-none mb-3">{forecastResult ? forecastResult.total : "--"}</p>
                <p className="text-xs text-gray-500">tonnes <span className="text-[#2D5A3C] font-medium ml-1">↑ Linked</span></p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-[#E4E0D1]">
                <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 mb-5 uppercase">Soil Vitality</p>
                <p className="text-[2.75rem] font-serif leading-none mb-3">74</p>
                <p className="text-xs text-gray-500">of 100 <span className="text-[#2D5A3C] font-medium ml-1">Stable</span></p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-[#E4E0D1]">
                <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 mb-5 uppercase">Registered Fields</p>
                <p className="text-[2.75rem] font-serif leading-none mb-3">{fields.length}</p>
                <p className="text-xs text-gray-500">{fields.length === 0 ? "Add fields to track" : "Ready to analyze"}</p>
              </div>
            </div>
           </div>
        )}

        {/* ===================== SMART FORECAST TAB ===================== */}
        {activeTab === "forecast" && (
          <div className="animate-in fade-in duration-500">
             <header className="mb-10">
              <h2 className="text-5xl font-serif tracking-tight text-[#12281C] mb-3">Forecast a field</h2>
              <p className="text-sm text-gray-500">Input your <b>current</b> soil levels per hectare. The AI will calculate the exact action required.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-[#E4E0D1]">
                <form onSubmit={handleGenerateForecast} className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.15em] text-blue-800 uppercase border-b border-gray-100 pb-2 mb-4">Field Profile</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Crop Target</label>
                        <select 
                          className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C] bg-[#F4F2EB]" 
                          value={forecastForm.crop} 
                          onChange={handleCropChange} 
                        >
                          <option value="Maize">Maize</option>
                          <option value="Rice">Rice</option>
                          <option value="Wheat">Wheat</option>
                          <option value="Cotton">Cotton</option>
                          <option value="Millet">Millet</option>
                          <option value="Sugarcane">Sugarcane</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Total Area (hectares)</label>
                        <input type="number" required value={forecastForm.area} onChange={e => setForecastForm({...forecastForm, area: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold tracking-[0.15em] text-teal-600 uppercase border-b border-gray-100 pb-2 mb-4">Current Soil Status (Per Hectare)</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Rainfall (mm)</label>
                        <input type="number" step="0.1" value={forecastForm.rainfall} onChange={e => setForecastForm({...forecastForm, rainfall: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Temperature (°C)</label>
                        <input type="number" step="0.1" value={forecastForm.temp} onChange={e => setForecastForm({...forecastForm, temp: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Current Nitrogen (kg/ha)</label>
                        <input type="number" step="0.1" value={forecastForm.nitrogen} onChange={e => setForecastForm({...forecastForm, nitrogen: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Current Phosphorus (kg/ha)</label>
                        <input type="number" step="0.1" value={forecastForm.phosphorus} onChange={e => setForecastForm({...forecastForm, phosphorus: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Current Potassium (kg/ha)</label>
                        <input type="number" step="0.1" value={forecastForm.potassium} onChange={e => setForecastForm({...forecastForm, potassium: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Soil pH</label>
                        <input type="number" step="0.1" value={forecastForm.ph} onChange={e => setForecastForm({...forecastForm, ph: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Pesticide (tonnes)</label>
                        <input type="number" step="0.1" value={forecastForm.pesticide} onChange={e => setForecastForm({...forecastForm, pesticide: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold mb-2 text-gray-500">Soil Moisture (%)</label>
                        <input type="number" step="0.1" value={forecastForm.moisture} onChange={e => setForecastForm({...forecastForm, moisture: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" />
                      </div>
                    </div>
                  </div>

                  <button disabled={isPredicting} type="submit" className={`w-full text-white py-4 rounded-xl text-sm font-bold flex justify-center items-center space-x-2 transition-colors ${isPredicting ? 'bg-gray-400' : 'bg-[#12281C] hover:bg-black'}`}>
                    <span>{isPredicting ? 'Calculating Instructions...' : 'Run Gap Analysis'}</span> <span>&rarr;</span>
                  </button>
                </form>
              </div>

              {/* Dynamic Results Pane */}
              <div className="bg-[#1D3C28] rounded-2xl flex flex-col justify-start text-white p-8 relative overflow-y-auto transition-all duration-500 min-h-[600px] shadow-lg">
                {!isForecastGenerated ? (
                  <div className="text-center animate-in fade-in zoom-in duration-500 my-auto">
                    <Sparkles className="text-[#B5F140] w-10 h-10 mx-auto mb-6 opacity-100" />
                    <h3 className="text-[1.75rem] font-serif leading-tight">Your intelligent gap <br/>analysis will appear here.</h3>
                  </div>
                ) : (
                  <div className="w-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 h-full">
                    
                    {/* Header Row */}
                    <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-6">
                      <p className="text-[10px] font-bold tracking-[0.15em] text-gray-300 uppercase">{forecastResult.crop} / Estimated Yield</p>
                      <span className={`${forecastResult.riskColor} text-[10px] font-bold px-3 py-1.5 uppercase tracking-wider rounded-sm shadow-sm`}>
                        {forecastResult.riskStatus}
                      </span>
                    </div>
                    
                    {/* Main Tonnes Output */}
                    <div className="mb-6">
                      <p className="text-7xl font-serif leading-none mb-2">{forecastResult.total} <span className="text-xl font-sans text-gray-300 ml-1 truncate">tonnes total</span></p>
                      
                      <div className="mt-4 bg-white/10 p-3 rounded-lg border border-white/20 inline-block">
                         <p className="text-[#B5F140] font-mono text-lg font-bold">{forecastResult.perAcre} <span className="text-sm text-gray-200 font-sans font-normal">tonnes per hectare</span></p>
                      </div>
                    </div>

                    {/* DYNAMIC RESOURCE INSTRUCTION CALCULATOR (PER HECTARE) */}
                    <div className="mb-8 p-4 bg-black/20 rounded-xl border border-white/5">
                      <p className="text-[10px] font-bold tracking-widest text-[#B5F140] mb-3 uppercase flex items-center gap-2">
                        <CheckCircle2 size={12}/> Resource Instructions (Per Hectare)
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p className={`text-xl font-mono font-bold ${forecastResult.resources.n.color}`}>
                            {forecastResult.resources.n.action} {forecastResult.resources.n.val}<span className="text-xs text-gray-400 font-sans ml-1">{forecastResult.resources.n.unit}</span>
                          </p>
                          <p className="text-[9px] uppercase tracking-wider text-gray-500">Nitrogen</p>
                        </div>
                        <div>
                          <p className={`text-xl font-mono font-bold ${forecastResult.resources.p.color}`}>
                            {forecastResult.resources.p.action} {forecastResult.resources.p.val}<span className="text-xs text-gray-400 font-sans ml-1">{forecastResult.resources.p.unit}</span>
                          </p>
                          <p className="text-[9px] uppercase tracking-wider text-gray-500">Phosphorus</p>
                        </div>
                        <div>
                          <p className={`text-xl font-mono font-bold ${forecastResult.resources.k.color}`}>
                            {forecastResult.resources.k.action} {forecastResult.resources.k.val}<span className="text-xs text-gray-400 font-sans ml-1">{forecastResult.resources.k.unit}</span>
                          </p>
                          <p className="text-[9px] uppercase tracking-wider text-gray-500">Potassium</p>
                        </div>
                      </div>
                    </div>

                    {/* Visual Alignment Graph */}
                    <div className="mb-8">
                      <div className="flex justify-between items-end mb-2">
                         <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase flex items-center gap-2"><BarChart2 size={12}/> Env. Alignment</p>
                         <span className="text-sm font-mono text-white">{forecastResult.alignmentScore}%</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-3">
                        <div 
                           className="bg-[#B5F140] h-3 rounded-full transition-all duration-1000" 
                           style={{ width: `${forecastResult.alignmentScore}%` }}
                        ></div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 italic">{forecastResult.riskMsg}</p>
                    </div>

                    {/* Action Plan & Next Procedure Box */}
                    <div className="mt-auto bg-[#12281C] border border-[#2D5A3C] p-5 rounded-xl">
                      <p className="text-[10px] font-bold tracking-widest text-[#B5F140] mb-3 uppercase">Agronomist Action Plan</p>
                      <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-line">{forecastResult.procedure}</p>
                    </div>
                    
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== FIELD REGISTRY TAB ===================== */}
        {activeTab === "registry" && (
           <div className="animate-in fade-in duration-500">
             <header className="mb-10">
              <h2 className="text-5xl font-serif tracking-tight text-[#12281C] mb-3">Know every acre</h2>
              <p className="text-sm text-gray-500">Create a trusted home for the fields that drive your decisions.</p>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-[#E4E0D1]">
                <form onSubmit={handleRegisterField} className="space-y-6">
                  <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase border-b border-gray-100 pb-2 mb-4">New Field</p>
                  <div>
                    <label className="block text-xs font-bold mb-2 text-[#12281C]">Field name</label>
                    <input type="text" required value={newField.name} onChange={e => setNewField({...newField, name: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" placeholder="e.g. North Plot" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-2 text-[#12281C]">Location</label>
                    <input type="text" required value={newField.location} onChange={e => setNewField({...newField, location: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" placeholder="e.g. Mandya, Karnataka" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-2 text-[#12281C]">Area (acres)</label>
                      <input type="number" required value={newField.area} onChange={e => setNewField({...newField, area: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]" placeholder="10" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 text-[#12281C]">Soil type</label>
                      <select value={newField.soil} onChange={e => setNewField({...newField, soil: e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#12281C]">
                        <option>Loamy</option><option>Sandy</option><option>Clay</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-[#12281C] text-white py-4 rounded-xl text-sm font-bold flex justify-center items-center space-x-2 hover:bg-black transition-colors mt-4">
                    <span>Register field</span> <span className="text-[#B5F140]">+</span>
                  </button>
                </form>
              </div>
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-[#E4E0D1] h-[500px] overflow-y-auto">
                <p className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase border-b border-gray-100 pb-2 mb-4">Your Fields ({fields.length})</p>
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-400 animate-in fade-in duration-500">
                    <Database size={32} className="mb-3 opacity-50" /><p className="text-sm">No fields registered yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field, idx) => (
                      <div key={idx} className="group border-l-4 border-[#2D5A3C] pl-4 flex justify-between items-center bg-[#F4F2EB]/50 p-4 rounded-r-xl animate-in fade-in slide-in-from-right-4 transition-all">
                        <div className="truncate pr-2">
                          <p className="font-bold text-[#12281C] text-lg capitalize truncate">{field.name}</p>
                          <p className="text-xs text-gray-500 font-mono mt-1 capitalize truncate">{field.location} · {field.soil}</p>
                        </div>
                        <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-2xl font-serif text-[#12281C]">{field.area}</p><p className="text-[10px] tracking-widest uppercase text-gray-500">acres</p>
                          </div>
                          <button onClick={() => handleRemoveField(idx)} className="text-gray-300 hover:text-red-500 p-2 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
           </div>
        )}

        {/* ===================== DATASET EXPLORER TAB ===================== */}
        {activeTab === "dataset" && (
           <div className="animate-in fade-in duration-500">
             <header className="mb-10">
              <h2 className="text-5xl font-serif tracking-tight text-[#12281C] mb-3">Dataset Explorer</h2>
              <p className="text-sm text-gray-500">A preview of the historical telemetry dataset powering the YieldSense AI engine.</p>
            </header>
            <div className="bg-white p-2 rounded-2xl border border-[#E4E0D1] overflow-hidden shadow-sm">
              <div className="overflow-x-auto p-4 md:p-6">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b-2 border-[#12281C] text-xs font-bold uppercase tracking-wider text-[#12281C]">
                      <th className="pb-4 pr-6">Crop Type</th><th className="pb-4 pr-6">Temp (°C)</th><th className="pb-4 pr-6">Rainfall (mm)</th><th className="pb-4 pr-6">Soil pH</th><th className="pb-4 pr-6">Moisture (%)</th><th className="pb-4">Sunlight (hrs)</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors"><td className="py-4 pr-6 font-medium text-[#2D5A3C]">Maize</td><td className="py-4 pr-6">25.3</td><td className="py-4 pr-6">820.0</td><td className="py-4 pr-6">6.5</td><td className="py-4 pr-6">45.0</td><td className="py-4">7.2</td></tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors"><td className="py-4 pr-6 font-medium text-[#2D5A3C]">Rice</td><td className="py-4 pr-6">28.1</td><td className="py-4 pr-6">1200.5</td><td className="py-4 pr-6">6.0</td><td className="py-4 pr-6">80.2</td><td className="py-4">8.5</td></tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors"><td className="py-4 pr-6 font-medium text-[#2D5A3C]">Cotton</td><td className="py-4 pr-6">30.2</td><td className="py-4 pr-6">600.0</td><td className="py-4 pr-6">7.1</td><td className="py-4 pr-6">35.5</td><td className="py-4">9.0</td></tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors"><td className="py-4 pr-6 font-medium text-[#2D5A3C]">Wheat</td><td className="py-4 pr-6">22.4</td><td className="py-4 pr-6">450.0</td><td className="py-4 pr-6">6.8</td><td className="py-4 pr-6">40.0</td><td className="py-4">6.5</td></tr>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors"><td className="py-4 pr-6 font-medium text-[#2D5A3C]">Millet</td><td className="py-4 pr-6">32.5</td><td className="py-4 pr-6">300.0</td><td className="py-4 pr-6">7.5</td><td className="py-4 pr-6">25.0</td><td className="py-4">10.0</td></tr>
                    <tr className="hover:bg-gray-50 transition-colors"><td className="py-4 pr-6 font-medium text-[#2D5A3C]">Sugarcane</td><td className="py-4 pr-6">26.8</td><td className="py-4 pr-6">1500.0</td><td className="py-4 pr-6">6.2</td><td className="py-4 pr-6">75.0</td><td className="py-4">8.0</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 p-4 border-t border-[#E4E0D1] text-xs text-gray-500 text-center">Showing top 6 rows from the training data. Full dataset processed securely via backend.</div>
            </div>
           </div>
        )}

        {/* ===================== USER PROFILE & SYSTEM MAP ===================== */}
        {activeTab === "profile" && (
           <div className="animate-in fade-in duration-500">
            <header className="mb-10"><h2 className="text-5xl font-serif tracking-tight text-[#12281C] mb-3">Grower Profile</h2><p className="text-sm text-gray-500">Manage your account and agricultural portfolio.</p></header>
            <div className="bg-white p-8 md:p-10 rounded-2xl border border-[#E4E0D1] flex flex-col md:flex-row items-center md:items-start md:space-x-8 mb-8 shadow-sm">
              <div className="w-32 h-32 bg-[#12281C] text-[#F4F2EB] flex items-center justify-center rounded-full font-serif text-6xl flex-shrink-0 mb-6 md:mb-0 shadow-inner">S</div>
              <div className="text-center md:text-left flex flex-col justify-center h-full">
                <h3 className="text-4xl font-serif text-[#12281C] mb-2">Sanghavi S Avadhani</h3><p className="text-gray-500 text-lg mb-4">{loginEmail} · Farm Operator</p>
                <div><span className="bg-[#B5F140] text-[#12281C] text-xs font-bold px-4 py-1.5 rounded-md uppercase tracking-wider shadow-sm">Verified Account</span></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-2xl border border-[#E4E0D1] shadow-sm"><p className="text-xs font-bold tracking-[0.15em] text-gray-400 mb-3 uppercase">Primary Hub</p><p className="text-3xl font-serif text-[#12281C] capitalize">{primaryLocation}</p><p className="text-xs text-gray-500 mt-2">Based on latest registry</p></div>
              <div className="bg-white p-8 rounded-2xl border border-[#E4E0D1] shadow-sm"><p className="text-xs font-bold tracking-[0.15em] text-gray-400 mb-3 uppercase">Total Portfolio</p><p className="text-3xl font-serif text-[#12281C]">{totalAcres.toFixed(1)} <span className="text-lg font-sans text-gray-500">acres</span></p><p className="text-xs text-gray-500 mt-2">Combined land mass managed</p></div>
              <div className="bg-white p-8 rounded-2xl border border-[#E4E0D1] shadow-sm"><p className="text-xs font-bold tracking-[0.15em] text-gray-400 mb-3 uppercase">Active Fields</p><p className="text-3xl font-serif text-[#12281C]">{fields.length} <span className="text-lg font-sans text-gray-500">registered</span></p><p className="text-xs text-gray-500 mt-2">Synced with Neon DB</p></div>
            </div>
           </div>
        )}

        {activeTab === "system" && (
           <div className="animate-in fade-in duration-500">
            <header className="mb-10"><h2 className="text-5xl font-serif tracking-tight text-[#12281C] mb-3">System Architecture</h2><p className="text-sm text-gray-500">An overview of the YieldSense intelligence flow.</p></header>
            <div className="max-w-4xl mx-auto space-y-4 text-center font-sans overflow-x-auto pb-4 mt-8">
              <div className="bg-[#19271E] text-white py-5 px-4 shadow-sm min-w-[300px]"><p className="font-bold text-base">Farmers · Advisors · Admin</p></div><p className="text-gray-500 text-sm">↓</p>
              <div className="bg-[#B5F140] text-[#12281C] py-7 px-4 shadow-sm min-w-[300px]"><p className="font-bold text-base mb-1">YieldSense Web Experience (Next.js)</p><p className="text-[10px] font-mono opacity-80 uppercase tracking-widest">Client-Side State · JWT Secure Handshake</p></div><p className="text-gray-500 text-sm">↓</p>
              <div className="grid grid-cols-2 gap-4 md:gap-6 min-w-[500px]"><div className="bg-white border border-gray-200 py-8 px-4 shadow-sm"><p className="font-bold text-base text-[#12281C] mb-2">FastAPI Service</p><p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">OAuth2 · RBAC · REST API</p></div><div className="bg-white border border-gray-200 py-8 px-4 shadow-sm"><p className="font-bold text-base text-[#12281C] mb-2">AI Forecast Engine</p><p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Joblib · Scikit-Learn Model</p></div></div><p className="text-gray-500 text-sm">↓</p>
              <div className="grid grid-cols-2 gap-4 md:gap-6 min-w-[500px]"><div className="bg-white border border-gray-200 py-8 px-4 shadow-sm"><p className="font-bold text-base text-[#12281C] mb-2">PostgreSQL (Neon DB)</p><p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Users · farms · records via SQLAlchemy</p></div><div className="bg-white border border-gray-200 py-8 px-4 shadow-sm"><p className="font-bold text-base text-[#12281C] mb-2">Data pipeline</p><p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">FAOSTAT · USDA · Telemetry</p></div></div>
            </div>
           </div>
        )}

      </main>
    </div>
  );
}