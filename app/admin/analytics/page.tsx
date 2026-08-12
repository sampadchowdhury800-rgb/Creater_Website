"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Activity, MousePointerClick, Globe } from "lucide-react";
import { toast } from "react-toastify";

interface AnalyticsData {
  totalVisits: number;
  topPaths: { path: string; count: number }[];
  topReferrers: { referer: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/analytics`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (error) {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Website traffic and performance (Last 30 Days)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center space-x-4">
          <div className="p-4 bg-primary/10 rounded-full text-primary">
            <Activity className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Visits</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.totalVisits.toLocaleString()}</p>
          </div>
        </div>
        
        {/* Placeholder cards for future metrics */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center space-x-4 opacity-50">
          <div className="p-4 bg-green-500/10 rounded-full text-green-500">
            <MousePointerClick className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Engagement</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">--</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center space-x-4 opacity-50">
          <div className="p-4 bg-purple-500/10 rounded-full text-purple-500">
            <Globe className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Visitors</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">--</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top Pages</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Page Path</th>
                  <th className="px-6 py-4 text-right">Visits</th>
                </tr>
              </thead>
              <tbody>
                {data.topPaths.length === 0 ? (
                  <tr><td colSpan={2} className="px-6 py-4 text-center">No data yet</td></tr>
                ) : (
                  data.topPaths.map((p, i) => (
                    <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{p.path}</td>
                      <td className="px-6 py-4 text-right">{p.count.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top Referrers</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4 text-right">Referrals</th>
                </tr>
              </thead>
              <tbody>
                {data.topReferrers.length === 0 ? (
                  <tr><td colSpan={2} className="px-6 py-4 text-center">No data yet</td></tr>
                ) : (
                  data.topReferrers.map((r, i) => (
                    <tr key={i} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{r.referer}</td>
                      <td className="px-6 py-4 text-right">{r.count.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
