import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, Users, CheckCircle, TrendingUp, TrendingDown, Calendar, Search, Download, Globe, DollarSign, Languages, Filter, Activity, Clock, Zap, Target, BarChart3, PieChart, MessageCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { isAdminEmail } from "@/lib/admins";


export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [featureRequests, setFeatureRequests] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [stats, setStats] = useState({
    totalUsers: 0,
    completedOnboarding: 0,
    locationEnabled: 0
  });
  const [advancedMetrics, setAdvancedMetrics] = useState({
    dau: 0,
    mau: 0,
    realTimeActive: 0,
    avgSessionDuration: 0,
    topFeatures: [],
    stickiness: 0,
    returnRate: 0
  });
  const [referralSources, setReferralSources] = useState({});
  const [signUpTrends, setSignUpTrends] = useState({
    last7Days: [],
    thisWeek: 0,
    lastWeek: 0,
    thisMonth: 0,
    growthRate: 0
  });
  const [demographics, setDemographics] = useState({
    countries: {},
    currencies: {},
    languages: {}
  });
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [showAllReferrals, setShowAllReferrals] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Refresh real-time metrics every 30 seconds
    const interval = setInterval(() => {
      loadRealTimeMetrics();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Admin gate via Supabase (native-safe); non-admins go home.
      if (!isAdminEmail(authUser?.email)) {
        navigate(createPageUrl("Home"));
        return;
      }
      setCurrentUser({ email: authUser?.email });

      // Fetch all data via backend function with service role
      const { data } = await base44.functions.invoke('getAdminDashboardData');
      
      if (data.error) {
        throw new Error(data.error);
      }

      const allUsers = data.users;
      const allEvents = data.events;

      setUsers(allUsers);
      setEvents(allEvents);
      setFeatureRequests(data.featureRequests);
      setContactMessages(data.contactMessages);

      // Calculate stats
      const totalUsers = allUsers.length;
      const completedOnboarding = allUsers.filter(u => u.onboarding_completed).length;
      const locationEnabled = allUsers.filter(u => u.location_enabled).length;

      setStats({
        totalUsers,
        completedOnboarding,
        locationEnabled
      });

      // Calculate referral sources
      const sources = {};
      allUsers.forEach(user => {
        const source = user.referral_source || 'Unknown';
        sources[source] = (sources[source] || 0) + 1;
      });
      setReferralSources(sources);

      // Calculate sign-up trends
      calculateSignUpTrends(allUsers);

      // Calculate demographics
      calculateDemographics(allUsers);

      // Calculate advanced metrics
      calculateAdvancedMetrics(allUsers, allEvents); 

      setLoading(false);
    } catch (error) {
      // The dashboard's data still comes from Base44 (User/UserEvent/etc.), which
      // 403s on native. Don't bounce the admin out — render the page with empty
      // state. (Real user data needs a Supabase admin route — tracked follow-up.)
      console.error("Error loading dashboard:", error);
      setLoading(false);
    }
  };

  const loadRealTimeMetrics = async () => {
    try {
      const { data } = await base44.functions.invoke('getAdminDashboardData');
      if (data.error) return;
      
      const allEvents = data.events;
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      // Count unique users active in last 5 minutes
      const recentEvents = allEvents.filter(event => {
        const eventDate = new Date(event.created_date);
        return eventDate >= fiveMinutesAgo;
      });
      
      const activeUsers = new Set(recentEvents.map(e => e.user_email)).size;
      
      setAdvancedMetrics(prev => ({
        ...prev,
        realTimeActive: activeUsers
      }));
    } catch (error) {
      console.error("Error loading real-time metrics:", error);
    }
  };

  const calculateAdvancedMetrics = (allUsers, allEvents) => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Daily Active Users (DAU)
    const dauEvents = allEvents.filter(event => {
      const eventDate = new Date(event.created_date);
      return eventDate >= today && event.event_type === 'login';
    });
    const dau = new Set(dauEvents.map(e => e.user_email)).size;
    
    // Monthly Active Users (MAU)
    const mauEvents = allEvents.filter(event => {
      const eventDate = new Date(event.created_date);
      return eventDate >= monthStart && event.event_type === 'login';
    });
    const mau = new Set(mauEvents.map(e => e.user_email)).size;
    
    // Stickiness (DAU/MAU)
    const stickiness = mau > 0 ? (dau / mau * 100) : 0;
    
    // Real-time active users (last 5 minutes)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const realtimeEvents = allEvents.filter(event => {
      const eventDate = new Date(event.created_date);
      return eventDate >= fiveMinutesAgo;
    });
    const realTimeActive = new Set(realtimeEvents.map(e => e.user_email)).size;
    
    // Average session duration
    const sessionEndEvents = allEvents.filter(e => e.event_type === 'session_end' && e.metadata?.duration_seconds);
    const avgSessionDuration = sessionEndEvents.length > 0
      ? sessionEndEvents.reduce((sum, e) => sum + (e.metadata.duration_seconds || 0), 0) / sessionEndEvents.length
      : 0;
    
    // Top features used
    const featureEvents = allEvents.filter(e => e.event_type === 'feature_used' && e.feature_name);
    const featureCounts = {};
    featureEvents.forEach(event => {
      const feature = event.feature_name;
      featureCounts[feature] = (featureCounts[feature] || 0) + 1;
    });
    
    const topFeatures = Object.entries(featureCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([feature, count]) => ({
        name: feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count,
        percentage: (count / (featureEvents.length || 1) * 100).toFixed(1)
      }));
    
    // Return rate (users who came back after first day)
    const userFirstLogins = {};
    allEvents
      .filter(e => e.event_type === 'login')
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
      .forEach(event => {
        if (!userFirstLogins[event.user_email]) {
          userFirstLogins[event.user_email] = new Date(event.created_date);
        }
      });
    
    const usersWhoReturned = Object.entries(userFirstLogins).filter(([email, firstLogin]) => {
      const dayAfterFirst = new Date(firstLogin);
      dayAfterFirst.setDate(dayAfterFirst.getDate() + 1);
      
      const returnedEvents = allEvents.filter(e => 
        e.user_email === email && 
        e.event_type === 'login' && 
        new Date(e.created_date) >= dayAfterFirst
      );
      
      return returnedEvents.length > 0;
    }).length;
    
    const returnRate = Object.keys(userFirstLogins).length > 0
      ? (usersWhoReturned / Object.keys(userFirstLogins).length * 100)
      : 0;
    
    setAdvancedMetrics({
      dau,
      mau,
      realTimeActive,
      avgSessionDuration: Math.round(avgSessionDuration),
      topFeatures,
      stickiness: stickiness.toFixed(1),
      returnRate: returnRate.toFixed(1)
    });
  };

  const calculateSignUpTrends = (allUsers) => {
    const now = new Date();
    const last7Days = [];
    
    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = allUsers.filter(user => {
        const createdDate = new Date(user.created_date);
        return createdDate >= date && createdDate < nextDate;
      }).length;
      
      last7Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      });
    }
    
    // Calculate this week vs last week
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeek = allUsers.filter(user => {
      const createdDate = new Date(user.created_date);
      return createdDate >= weekStart;
    }).length;

    const lastWeek = allUsers.filter(user => {
      const createdDate = new Date(user.created_date);
      return createdDate >= lastWeekStart && createdDate < weekStart;
    }).length;

    const thisMonth = allUsers.filter(user => {
      const createdDate = new Date(user.created_date);
      return createdDate.getMonth() === now.getMonth() && 
             createdDate.getFullYear() === now.getFullYear();
    }).length;

    const growthRate = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : (thisWeek > 0 ? 100 : 0);

    setSignUpTrends({
      last7Days,
      thisWeek,
      lastWeek,
      thisMonth,
      growthRate
    });
  };

  const calculateDemographics = (allUsers) => {
    const countries = {};
    const currencies = {};
    const languages = {};

    allUsers.forEach(user => {
      if (user.home_country) {
        countries[user.home_country] = (countries[user.home_country] || 0) + 1;
      }
      if (user.preferred_currency) {
        currencies[user.preferred_currency] = (currencies[user.preferred_currency] || 0) + 1;
      }
      if (user.preferred_language) {
        languages[user.preferred_language] = (languages[user.preferred_language] || 0) + 1;
      }
    });

    setDemographics({ countries, currencies, languages });
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        filterStatus === "all" ||
        (filterStatus === "completed" && user.onboarding_completed) ||
        (filterStatus === "pending" && !user.onboarding_completed);

      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, filterStatus]);

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Referral Source', 'Onboarding Status', 'Location Enabled', 'Home Country', 'Currency', 'Joined Date'];
    const rows = users.map(user => [
      user.full_name || 'N/A',
      user.email,
      user.referral_source || 'Unknown',
      user.onboarding_completed ? 'Completed' : 'Pending',
      user.location_enabled ? 'Yes' : 'No',
      user.home_country || 'N/A',
      user.preferred_currency || 'N/A',
      user.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `globeskimmers-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getReferralSourceLabel = (key) => {
    const labels = {
      'google_search': 'Google Search',
      'social_media': 'Social Media',
      'friend': 'Friend/Family',
      'app_store': 'App Store',
      'advertisement': 'Advertisement',
      'other': 'Other',
      'Unknown': 'Not Set'
    };
    return labels[key] || key;
  };

  const getReferralSourceIcon = (key) => {
    const icons = {
      'google_search': '🔍',
      'social_media': '📱',
      'friend': '👥',
      'app_store': '📲',
      'advertisement': '📢',
      'other': '💭',
      'Unknown': '❓'
    };
    return icons[key] || '📊';
  };

  const getReferralSourceColor = (key) => {
    const colors = {
      'google_search': 'from-blue-500 to-blue-600',
      'social_media': 'from-pink-500 to-purple-600',
      'friend': 'from-green-500 to-teal-600',
      'app_store': 'from-indigo-500 to-purple-600',
      'advertisement': 'from-orange-500 to-red-600',
      'other': 'from-gray-500 to-gray-600',
      'Unknown': 'from-gray-400 to-gray-500'
    };
    return colors[key] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f7fafc] to-[#e2e8f0] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const completionRate = stats.totalUsers > 0 ? ((stats.completedOnboarding / stats.totalUsers) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7fafc] to-[#e2e8f0]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-6 py-6">
        <button
          onClick={() => navigate(createPageUrl("Settings"))}
          className="mb-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h1 className="text-2xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-sm opacity-90">Comprehensive analytics and user management</p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Hero Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {signUpTrends.thisMonth} joined this month
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Daily Active Users</p>
                <p className="text-3xl font-bold text-gray-900">{advancedMetrics.dau}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {advancedMetrics.mau} monthly active
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center relative">
                <Zap className="w-6 h-6 text-orange-600" />
                {advancedMetrics.realTimeActive > 0 && ( 
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Active Now</p>
                <p className="text-3xl font-bold text-gray-900">{advancedMetrics.realTimeActive}</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {advancedMetrics.realTimeActive > 0 ? '🟢' : '⚪'} Live (last 5 min)
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                signUpTrends.growthRate >= 0 ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                {signUpTrends.growthRate >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Weekly Growth</p>
                <p className={`text-3xl font-bold ${
                  signUpTrends.growthRate >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {signUpTrends.growthRate > 0 ? '+' : ''}{signUpTrends.growthRate.toFixed(0)}%
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {signUpTrends.thisWeek} this week
            </div>
          </motion.div>
        </div>

        {/* Engagement Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">User Stickiness</h3>
            </div>
            <p className="text-4xl font-bold text-purple-600 mb-2">{advancedMetrics.stickiness}%</p>
            <p className="text-sm text-gray-600">DAU/MAU Ratio</p>
            <div className="mt-3 p-2 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-800">
                {parseFloat(advancedMetrics.stickiness) > 50 ? '🎉 Excellent!' : 
                 parseFloat(advancedMetrics.stickiness) > 20 ? '✅ Good' : '📈 Room to grow'}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-gray-900">Avg Session</h3>
            </div>
            <p className="text-4xl font-bold text-blue-600 mb-2">
              {formatDuration(advancedMetrics.avgSessionDuration)}
            </p>
            <p className="text-sm text-gray-600">Per user session</p>
            <div className="mt-3 p-2 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                Based on {events.filter(e => e.event_type === 'session_end').length} sessions
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl shadow-lg p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-gray-900">Return Rate</h3>
            </div>
            <p className="text-4xl font-bold text-green-600 mb-2">{advancedMetrics.returnRate}%</p>
            <p className="text-sm text-gray-600">Users came back</p>
            <div className="mt-3 p-2 bg-green-50 rounded-lg">
              <p className="text-xs text-green-800">
                Users who returned after Day 1
              </p>
            </div>
          </motion.div>
        </div>

        {/* Feature Usage & Sign-Up Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Feature Usage */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-[#667eea]" />
                <h2 className="text-xl font-bold text-gray-900">Most Used Features</h2>
              </div>
              {advancedMetrics.topFeatures.length > 5 && (
                <button
                  onClick={() => setShowAllFeatures(!showAllFeatures)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors text-sm font-semibold"
                >
                  {showAllFeatures ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show All ({advancedMetrics.topFeatures.length})
                    </>
                  )}
                </button>
              )}
            </div>

            {advancedMetrics.topFeatures.length > 0 ? (
              <div className="space-y-3">
                {(showAllFeatures ? advancedMetrics.topFeatures : advancedMetrics.topFeatures.slice(0, 5)).map((feature, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{feature.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{feature.count}</span>
                        <span className="text-xs text-gray-500">({feature.percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-600 transition-all duration-500"
                        style={{ width: `${feature.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No feature usage data yet</p>
                <p className="text-xs text-gray-400 mt-1">Data will appear as users interact with features</p>
              </div>
            )}

            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-purple-800">
                📊 Total feature interactions: {events.filter(e => e.event_type === 'feature_used').length}
              </p>
            </div>
          </motion.div>

          {/* 7-Day Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-6 h-6 text-[#667eea]" />
              <h2 className="text-xl font-bold text-gray-900">7-Day Sign-Up Trend</h2>
            </div>

            <div className="space-y-3">
              {signUpTrends.last7Days.map((day, index) => {
                const maxCount = Math.max(...signUpTrends.last7Days.map(d => d.count), 1);
                const percentage = (day.count / maxCount) * 100;
                
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{day.date}</span>
                      <span className="font-bold text-gray-900">{day.count} users</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>{signUpTrends.last7Days.reduce((sum, day) => sum + day.count, 0)} new users</strong> in the last 7 days
              </p>
            </div>
          </motion.div>
        </div>

        {/* Onboarding Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-[#667eea]" />
            <h2 className="text-xl font-bold text-gray-900">Onboarding Funnel</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Signed Up</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">100%</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Completed Onboarding</p>
                  <p className="text-2xl font-bold">{stats.completedOnboarding}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{completionRate}%</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Active Users</p>
                  <p className="text-2xl font-bold">{stats.locationEnabled}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {((stats.locationEnabled / stats.totalUsers) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-900">
              💡 <strong>Insight:</strong> {(100 - parseFloat(completionRate)).toFixed(0)}% of users haven't completed onboarding yet
            </p>
          </div>
        </motion.div>

        {/* Demographics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Home Countries */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-6 h-6 text-blue-600" />
              <h2 className="text-lg font-bold text-gray-900">Home Countries</h2>
            </div>

            {Object.keys(demographics.countries).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(demographics.countries)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([country, count]) => {
                    const percentage = ((count / stats.totalUsers) * 100).toFixed(0);
                    return (
                      <div key={country} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{country}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                          <span className="text-xs text-gray-500">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
            )}
          </motion.div>

          {/* Preferred Currencies */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">Currencies</h2>
            </div>

            {Object.keys(demographics.currencies).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(demographics.currencies)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([currency, count]) => {
                    const percentage = ((count / stats.totalUsers) * 100).toFixed(0);
                    return (
                      <div key={currency} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{currency}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                          <span className="text-xs text-gray-500">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
            )}
          </motion.div>

          {/* Preferred Languages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="bg-white rounded-2xl shadow-lg p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Languages className="w-6 h-6 text-purple-600" />
              <h2 className="text-lg font-bold text-gray-900">Languages</h2>
            </div>

            {Object.keys(demographics.languages).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(demographics.languages)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([language, count]) => {
                    const percentage = ((count / stats.totalUsers) * 100).toFixed(0);
                    return (
                      <div key={language} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{language}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                          <span className="text-xs text-gray-500">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
            )}
          </motion.div>
        </div>

        {/* Referral Sources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[#667eea]" />
              <h2 className="text-xl font-bold text-gray-900">Referral Sources</h2>
            </div>
            {Object.keys(referralSources).length > 5 && (
              <button
                onClick={() => setShowAllReferrals(!showAllReferrals)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors text-sm font-semibold"
              >
                {showAllReferrals ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show All ({Object.keys(referralSources).length})
                  </>
                )}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(referralSources)
              .sort((a, b) => b[1] - a[1])
              .slice(0, showAllReferrals ? undefined : 5)
              .map(([source, count]) => {
                const percentage = ((count / stats.totalUsers) * 100).toFixed(1);
                return (
                  <div key={source} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getReferralSourceIcon(source)}</span>
                        <span className="font-semibold text-gray-900">
                          {getReferralSourceLabel(source)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-gray-900">{count}</span>
                        <span className="text-sm text-gray-600 ml-2">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getReferralSourceColor(source)} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>

        {/* Recent Users with Search & Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Users ({filteredUsers.length})</h2>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="completed">Completed Onboarding</SelectItem>
                <SelectItem value="pending">Pending Onboarding</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Referral</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Country</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user, index) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900 font-medium">{user.full_name || 'N/A'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                      <td className="py-3 px-4 text-sm">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {getReferralSourceLabel(user.referral_source || 'Unknown')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{user.home_country || 'N/A'}</td>
                      <td className="py-3 px-4">
                        {user.onboarding_completed ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Complete
                          </span>
                        ) : (
                          <span className="text-orange-600 text-sm font-medium">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {user.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-gray-500">
                      No users found matching your criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Feature Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-3xl shadow-lg p-8 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <Send className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Feature Requests</h2>
            <span className="ml-auto bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">
              {featureRequests.length} Total
            </span>
          </div>

          <div className="space-y-3">
            {featureRequests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No feature requests yet</p>
            ) : (
              featureRequests.map((request) => (
                <div key={request.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{request.feature_name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{request.request_message}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      request.status === 'completed' ? 'bg-green-100 text-green-700' :
                      request.status === 'planned' ? 'bg-blue-100 text-blue-700' :
                      request.status === 'reviewed' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>👤 {request.user_email}</span>
                    <span>📅 {new Date(request.created_date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Contact Messages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-white rounded-3xl shadow-lg p-8 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Contact Messages</h2>
            <span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
              {contactMessages.filter(m => m.status === 'unread').length} Unread
            </span>
          </div>

          <div className="space-y-3">
            {contactMessages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No messages yet</p>
            ) : (
              contactMessages.map((message) => (
                <div key={message.id} className={`border-2 rounded-xl p-4 transition-colors ${
                  message.status === 'unread' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{message.subject}</h3>
                      <p className="text-sm text-gray-600 mt-1">{message.message}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ml-3 ${
                      message.status === 'replied' ? 'bg-green-100 text-green-700' :
                      message.status === 'read' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {message.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>👤 {message.user_name}</span>
                    <span>✉️ {message.user_email}</span>
                    <span>📅 {new Date(message.created_date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}