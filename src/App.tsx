import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  PiggyBank,
  ChevronRight,
  ArrowRight,
  Wallet,
  Clock,
  Edit2
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from './lib/utils';
import { SavingsPlan } from './types';

const STORAGE_KEY = 'ahorro_maestro_plans';

export default function App() {
  const [plans, setPlans] = useState<SavingsPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const plan = useMemo(() => plans.find(p => p.id === activePlanId) || null, [plans, activePlanId]);

  // Form state
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        const loadedPlans = parsed.map((p: any) => ({
          ...p,
          startDate: new Date(p.startDate),
          payments: p.payments.map((pay: any) => ({
            ...pay,
            paidAt: pay.paidAt ? new Date(pay.paidAt) : undefined
          }))
        }));
        setPlans(loadedPlans);
        if (loadedPlans.length > 0) {
          setActivePlanId(loadedPlans[0].id);
        }
      } catch (e) {
        console.error("Error loading plans", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const createPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetAmount);
    if (!title || isNaN(target)) return;

    const NUM_PAYMENTS = 48;
    const MAX_AMOUNT_PER_BOX = 100;
    let paymentAmounts: number[] = [];
    
    // Generate 48 weights with a power function to create a "long tail" 
    const weights = Array.from({ length: NUM_PAYMENTS }, () => Math.pow(Math.random(), 4) + 0.1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    // Initial scaling
    let amounts = weights.map(w => (w / totalWeight) * target);
    
    // Redistribution logic to respect the 100 cap if possible
    let excess = 0;
    amounts = amounts.map(a => {
      if (a > MAX_AMOUNT_PER_BOX) {
        excess += a - MAX_AMOUNT_PER_BOX;
        return MAX_AMOUNT_PER_BOX;
      }
      return a;
    });

    // Try to distribute excess to boxes that are under the cap
    if (excess > 0) {
      for (let i = 0; i < 10 && excess > 0.01; i++) { // Max 10 passes
        const underCapCount = amounts.filter(a => a < MAX_AMOUNT_PER_BOX).length;
        if (underCapCount === 0) break; // All boxes are at or above cap

        const addPerBox = excess / underCapCount;
        amounts = amounts.map(a => {
          if (a < MAX_AMOUNT_PER_BOX) {
            const canAdd = MAX_AMOUNT_PER_BOX - a;
            const toAdd = Math.min(addPerBox, canAdd);
            excess -= toAdd;
            return a + toAdd;
          }
          return a;
        });
      }
    }

    // Final rounding and ensuring exact total
    let currentSum = 0;
    paymentAmounts = amounts.map((a, index) => {
      if (index === NUM_PAYMENTS - 1) {
        return Math.max(1, Math.round(target - currentSum));
      }
      const rounded = Math.max(1, Math.round(a));
      currentSum += rounded;
      return rounded;
    });

    // Shuffle for non-sequential feel
    paymentAmounts.sort(() => Math.random() - 0.5);

    const start = new Date();
    
    const newPlan: SavingsPlan = {
      id: crypto.randomUUID(),
      title,
      targetAmount: target,
      currentAmount: 0,
      startDate: start,
      payments: paymentAmounts.map((amount) => {
        return {
          id: crypto.randomUUID(),
          amount: amount,
          isPaid: false
        };
      })
    };

    setPlans(prev => [...prev, newPlan]);
    setActivePlanId(newPlan.id);
    setIsCreating(false);
    // Reset form
    setTitle('');
    setTargetAmount('');
  };

  const startEditing = () => {
    if (!plan) return;
    setTitle(plan.title);
    setTargetAmount(plan.targetAmount.toString());
    setIsEditing(true);
  };

  const updatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    const target = parseFloat(targetAmount);
    if (!title || isNaN(target)) return;

    const start = plan.startDate;

    let updatedPayments = [...plan.payments];

    // If target amount changed, scale all payments to match new target
    if (target !== plan.targetAmount) {
      const scaleFactor = target / plan.targetAmount;
      updatedPayments = updatedPayments.map(p => ({
        ...p,
        amount: p.amount * scaleFactor
      }));
    }

    const currentAmount = updatedPayments
      .filter(p => p.isPaid)
      .reduce((sum, p) => sum + p.amount, 0);

    const updatedPlan = {
      ...plan,
      title,
      targetAmount: target,
      currentAmount,
      payments: updatedPayments
    };

    setPlans(prev => prev.map(p => p.id === plan.id ? updatedPlan : p));
    setIsEditing(false);
  };

  const togglePayment = (id: string) => {
    if (!plan) return;
    const updatedPayments = plan.payments.map(p => {
      if (p.id === id) {
        const isPaid = !p.isPaid;
        return { 
          ...p, 
          isPaid, 
          paidAt: isPaid ? new Date() : undefined 
        };
      }
      return p;
    });

    const currentAmount = updatedPayments
      .filter(p => p.isPaid)
      .reduce((sum, p) => sum + p.amount, 0);

    const updatedPlan = { ...plan, payments: updatedPayments, currentAmount };
    setPlans(prev => prev.map(p => p.id === plan.id ? updatedPlan : p));
  };

  const deletePlan = () => {
    if (!plan) return;
    if (window.confirm("¿Estás seguro de que quieres eliminar este plan?")) {
      const remainingPlans = plans.filter(p => p.id !== plan.id);
      setPlans(remainingPlans);
      if (remainingPlans.length > 0) {
        setActivePlanId(remainingPlans[0].id);
      } else {
        setActivePlanId(null);
      }
      setIsEditing(false);
    }
  };

  const progress = plan ? (plan.currentAmount / plan.targetAmount) * 100 : 0;
  
  const nextPayment = useMemo(() => {
    if (!plan) return null;
    return plan.payments.find(p => !p.isPaid);
  }, [plan]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 w-12 h-12 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center border-2 border-white">
              <PiggyBank className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Ahorro Gaudis</h1>
              <p className="text-slate-500 text-sm">Tu caja de dinero inteligente</p>
            </div>
          </div>
          {plan && (
            <div className="flex items-center gap-2">
              <button 
                onClick={startEditing}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Editar plan"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button 
                onClick={deletePlan}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Eliminar plan"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </header>

        {/* Plan Selector */}
        {plans.length > 0 && !isCreating && !isEditing && (
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlanId(p.id)}
                className={cn(
                  "px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all border",
                  activePlanId === p.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                )}
              >
                {p.title}
              </button>
            ))}
            <button
              onClick={() => {
                setTitle('');
                setTargetAmount('');
                setIsCreating(true);
              }}
              className="px-4 py-2 rounded-xl font-medium whitespace-nowrap bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Nuevo
            </button>
          </div>
        )}

        {plans.length === 0 && !isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-slate-200 border border-slate-100"
          >
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Empieza tu primer reto!</h2>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              Aún no tienes ningún plan de ahorro. Crea uno ahora para empezar a llenar tu caja de dinero inteligente.
            </p>
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 mx-auto"
            >
              Crear mi primer plan <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {(isCreating || isEditing) && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200 border border-slate-100"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Target className="text-indigo-600" /> {isEditing ? 'Editar Plan' : 'Nuevo Plan de Ahorro'}
              </h2>
              <form onSubmit={isEditing ? updatePlan : createPlan} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">¿Para qué estás ahorrando?</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Viaje a Japón, Laptop nueva..."
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Meta de ahorro ($)</label>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                    className="flex-1 px-6 py-4 rounded-2xl font-semibold text-slate-600 hover:bg-slate-100 transition-all order-2 sm:order-1"
                  >
                    Cancelar
                  </button>
                  {isEditing && (
                    <button 
                      type="button"
                      onClick={deletePlan}
                      className="flex-1 px-6 py-4 rounded-2xl font-semibold text-red-600 hover:bg-red-50 transition-all order-3 sm:order-2"
                    >
                      Eliminar Plan
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 order-1 sm:order-3"
                  >
                    {isEditing ? 'Guardar Cambios' : 'Crear Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {plan && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl shadow-md border border-slate-100"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <p className="text-slate-500 text-sm">Ahorrado</p>
                <h3 className="text-2xl font-bold">${plan.currentAmount.toLocaleString()}</h3>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="bg-indigo-600 h-full rounded-full"
                  />
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-3xl shadow-md border border-slate-100"
              >
                <div className="p-2 bg-emerald-50 rounded-lg w-fit mb-4">
                  <Target className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-slate-500 text-sm">Meta Total</p>
                <h3 className="text-2xl font-bold">${plan.targetAmount.toLocaleString()}</h3>
                <p className="text-xs text-slate-400 mt-2">Faltan ${(plan.targetAmount - plan.currentAmount).toLocaleString()}</p>
              </motion.div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Left Column: Next Payment */}
              <div className="lg:col-span-3 space-y-6">
                {nextPayment && (
                  <section className="bg-indigo-600 text-white p-6 rounded-3xl shadow-lg shadow-indigo-200 relative overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-indigo-100 text-sm font-medium mb-1">Sugerencia de pago</h3>
                      <div className="flex justify-between items-end">
                        <div>
                          <h4 className="text-3xl font-bold">${Math.round(nextPayment.amount).toLocaleString()}</h4>
                          <p className="text-indigo-200 text-sm mt-1 flex items-center gap-1">
                            <Clock className="w-4 h-4" /> Puedes elegir cualquier cuadro de la cuadrícula
                          </p>
                        </div>
                        <button 
                          onClick={() => togglePayment(nextPayment.id)}
                          className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2"
                        >
                          Pagar sugerido <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {/* Decorative circles */}
                    <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500 rounded-full opacity-20" />
                    <div className="absolute -right-5 -top-5 w-20 h-20 bg-indigo-400 rounded-full opacity-10" />
                  </section>
                )}
              </div>

              {/* Right Column: Payment Grid */}
              <div className="lg:col-span-2">
                <section className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 h-full max-h-[600px] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-indigo-600" /> Reto de 48 Cuadros
                    </h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                      {plan.payments.filter(p => p.isPaid).length} / 48
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                    {plan.payments.map((payment, index) => (
                      <motion.div 
                        key={payment.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => togglePayment(payment.id)}
                        className={cn(
                          "aspect-square rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all p-1 text-center relative overflow-hidden",
                          payment.isPaid 
                            ? "bg-emerald-500 border-emerald-600 text-white shadow-inner" 
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-400 hover:bg-white"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] font-bold block leading-tight",
                          payment.isPaid ? "text-emerald-100" : "text-slate-400"
                        )}>
                          #{index + 1}
                        </span>
                        <span className="text-[11px] font-black">
                          ${Math.round(payment.amount).toLocaleString()}
                        </span>
                        
                        {payment.isPaid && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -right-1 -bottom-1 bg-white rounded-full p-0.5"
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    <span>Meta: ${plan.targetAmount.toLocaleString()}</span>
                    <span>Restante: ${(plan.targetAmount - plan.currentAmount).toLocaleString()}</span>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
