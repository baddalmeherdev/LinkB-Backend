import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";

const C = Colors.dark;

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

// ─── Predefined test suite ───────────────────────────────────────────────────

interface TestCase {
  url: string;
  category: string;
  label: string;
  expectedStatus: "pass" | "fail" | "unsupported" | "invalid";
  note?: string;
}

const DEFAULT_TEST_CASES: TestCase[] = [
  // ── YouTube Shorts (3) ──────────────────────────────────────────────────
  {
    url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    category: "YT Shorts",
    label: "YT Short — Rick Roll",
    expectedStatus: "pass",
  },
  {
    url: "https://www.youtube.com/shorts/RnFHVGfmTnM",
    category: "YT Shorts",
    label: "YT Short #2",
    expectedStatus: "pass",
  },
  {
    url: "https://www.youtube.com/shorts/LjhCEhWiKXk",
    category: "YT Shorts",
    label: "YT Short #3",
    expectedStatus: "pass",
  },

  // ── YouTube Long-form (2) ───────────────────────────────────────────────
  {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "YT Long",
    label: "YT — Rick Astley",
    expectedStatus: "pass",
  },
  {
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    category: "YT Long",
    label: "YT — First YouTube Video",
    expectedStatus: "pass",
  },

  // ── TikTok (3) ──────────────────────────────────────────────────────────
  {
    url: "https://www.tiktok.com/@tiktok/video/7106594312292453675",
    category: "TikTok",
    label: "TikTok — Official Account",
    expectedStatus: "pass",
    note: "May fail due to datacenter IP block — retried with 3 strategies",
  },
  {
    url: "https://www.tiktok.com/@zachking/video/6768504823336815877",
    category: "TikTok",
    label: "TikTok — Zach King",
    expectedStatus: "pass",
    note: "May fail due to datacenter IP block — retried with 3 strategies",
  },
  {
    url: "https://vm.tiktok.com/ZMhFPv7Dw/",
    category: "TikTok",
    label: "TikTok — Short Link",
    expectedStatus: "pass",
    note: "Short link format — retried with 3 strategies",
  },

  // ── Instagram Reels (3) ─────────────────────────────────────────────────
  {
    url: "https://www.instagram.com/reel/CuNrSHyMEKL/",
    category: "Instagram",
    label: "Instagram Reel #1",
    expectedStatus: "pass",
    note: "May require login — expected partial failure on server",
  },
  {
    url: "https://www.instagram.com/reel/C3VmJ5MrVbX/",
    category: "Instagram",
    label: "Instagram Reel #2",
    expectedStatus: "pass",
    note: "May require login — expected partial failure on server",
  },
  {
    url: "https://www.instagram.com/p/C7N1DEdMuGo/",
    category: "Instagram",
    label: "Instagram Post Video",
    expectedStatus: "pass",
    note: "May require login — expected partial failure on server",
  },

  // ── Direct MP4 (2) ──────────────────────────────────────────────────────
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    category: "Direct MP4",
    label: "Big Buck Bunny (Google CDN)",
    expectedStatus: "pass",
  },
  {
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    category: "Direct MP4",
    label: "Small MP4 (w3schools)",
    expectedStatus: "pass",
  },

  // ── Edge Cases ───────────────────────────────────────────────────────────
  {
    url: "not-a-url",
    category: "Edge Case",
    label: "Invalid — Not a URL",
    expectedStatus: "invalid",
  },
  {
    url: "https://",
    category: "Edge Case",
    label: "Invalid — Empty HTTPS",
    expectedStatus: "invalid",
  },
  {
    url: "https://example.com/video.html",
    category: "Edge Case",
    label: "Unsupported Site",
    expectedStatus: "unsupported",
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestResult {
  url: string;
  category: string;
  status: "pass" | "fail" | "unsupported" | "invalid" | "pending" | "running";
  failedStep: "metadata" | "formats" | null;
  errorCode: string | null;
  errorMessage: string | null;
  strategyUsed: string | null;
  title: string | null;
  thumbnail: string | null;
  hasDuration: boolean;
  formatsAvailable: number;
  downloadable: boolean;
  retryAttempts: number;
  metadataMs: number;
  formatMs: number;
  totalMs: number;
  label?: string;
  note?: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  unsupported: number;
  invalid: number;
  successRate: number;
  totalMs: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: TestResult["status"]): string {
  switch (status) {
    case "pass": return "#22c55e";
    case "fail": return "#ef4444";
    case "unsupported": return "#f59e0b";
    case "invalid": return "#8b5cf6";
    case "running": return C.accent;
    default: return C.textMuted;
  }
}

function statusIcon(status: TestResult["status"]): string {
  switch (status) {
    case "pass": return "check-circle";
    case "fail": return "x-circle";
    case "unsupported": return "slash";
    case "invalid": return "alert-triangle";
    case "running": return "loader";
    default: return "clock";
  }
}

function statusLabel(status: TestResult["status"]): string {
  switch (status) {
    case "pass": return "PASS";
    case "fail": return "FAIL";
    case "unsupported": return "UNSUPPORTED";
    case "invalid": return "INVALID";
    case "running": return "TESTING...";
    default: return "PENDING";
  }
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    "YT Shorts": "#06b6d4",
    "YT Long": "#3b82f6",
    "TikTok": "#ec4899",
    "Instagram": "#f97316",
    "Direct MP4": "#10b981",
    "Edge Case": "#8b5cf6",
    "Custom": "#f59e0b",
  };
  return map[cat] ?? C.textMuted;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function failedStepLabel(step: "metadata" | "formats" | null): string {
  if (step === "metadata") return "Failed at: Metadata fetch";
  if (step === "formats") return "Failed at: Format detection";
  return "";
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TestModeScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const logScrollRef = useRef<ScrollView>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [customUrl, setCustomUrl] = useState("");
  const [customCategory, setCustomCategory] = useState("Custom");
  const [activeTab, setActiveTab] = useState<"results" | "logs">("results");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>(DEFAULT_TEST_CASES);
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-100

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 499)]);
  }, []);

  // Run yt-dlp self-update independently
  const handleUpdate = useCallback(async () => {
    if (isUpdating || isRunning) return;
    setIsUpdating(true);
    addLog("Triggering yt-dlp update...");
    try {
      const res = await fetch(`${BASE_URL}/api/video/update`);
      const data = await res.json() as { success?: boolean; version?: string; output?: string; message?: string };
      if (data.success) {
        setYtdlpVersion(data.version ?? null);
        addLog(`yt-dlp updated → ${data.version}`);
      } else {
        addLog(`Update failed: ${data.message ?? "unknown error"}`);
      }
    } catch (err) {
      addLog(`Update error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUpdating(false);
    }
  }, [isUpdating, isRunning, addLog]);

  const runTests = useCallback(async (cases: TestCase[], withUpdate = false) => {
    if (isRunning) return;
    if (cases.length === 0) {
      Alert.alert("No Tests", "Add at least one URL to test.");
      return;
    }

    setIsRunning(true);
    setSummary(null);
    setLogs([]);
    setProgress(0);

    // Initialise all results as pending
    const initialResults: TestResult[] = cases.map((tc) => ({
      url: tc.url,
      category: tc.category,
      label: tc.label,
      note: tc.note,
      status: "pending",
      failedStep: null,
      errorCode: null,
      errorMessage: null,
      strategyUsed: null,
      title: null,
      thumbnail: null,
      hasDuration: false,
      formatsAvailable: 0,
      downloadable: false,
      retryAttempts: 0,
      metadataMs: 0,
      formatMs: 0,
      totalMs: 0,
    }));
    setResults(initialResults);
    addLog(`Starting test run: ${cases.length} URL${cases.length !== 1 ? "s" : ""}`);

    const allResults: TestResult[] = [...initialResults];
    let firstBatch = true;

    // Run ONE URL at a time for maximum feedback granularity
    for (let i = 0; i < cases.length; i++) {
      const tc = cases[i];

      // Mark as running
      allResults[i] = { ...allResults[i], status: "running" };
      setResults([...allResults]);
      setProgress(Math.round((i / cases.length) * 100));

      try {
        const response = await fetch(`${BASE_URL}/api/video/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: [{ url: tc.url, category: tc.category }],
            autoUpdate: withUpdate && firstBatch,
          }),
          signal: AbortSignal.timeout ? AbortSignal.timeout(120_000) : undefined,
        });

        firstBatch = false;

        if (!response.ok) throw new Error(`Server error ${response.status}`);

        const data = await response.json() as {
          results: TestResult[];
          logs: string[];
          ytdlpVersion?: string;
        };

        if (data.ytdlpVersion && data.ytdlpVersion !== "unknown") {
          setYtdlpVersion(data.ytdlpVersion);
        }

        if (data.results?.[0]) {
          allResults[i] = {
            ...data.results[0],
            label: tc.label,
            note: tc.note,
          };
        }

        for (const log of (data.logs ?? [])) {
          addLog(log);
        }

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addLog(`Error testing ${tc.url}: ${errMsg}`);
        allResults[i] = {
          ...allResults[i],
          status: "fail",
          failedStep: "metadata",
          errorCode: "NETWORK_ERROR",
          errorMessage: "Could not reach test server. Check your connection.",
        };
      }

      setResults([...allResults]);
    }

    setProgress(100);

    // Final summary
    const passed = allResults.filter((r) => r.status === "pass").length;
    const failed = allResults.filter((r) => r.status === "fail").length;
    const unsupported = allResults.filter((r) => r.status === "unsupported").length;
    const invalid = allResults.filter((r) => r.status === "invalid").length;
    const finalSummary: TestSummary = {
      total: allResults.length,
      passed,
      failed,
      unsupported,
      invalid,
      successRate: allResults.length > 0 ? Math.round((passed / allResults.length) * 100) : 0,
      totalMs: 0,
    };
    setSummary(finalSummary);
    addLog(`Done: ${passed}/${allResults.length} passed (${finalSummary.successRate}% success rate)`);
    setIsRunning(false);

    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 300);
  }, [isRunning, addLog]);

  const handleAddCustomUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    const newCase: TestCase = {
      url: trimmed,
      category: customCategory || "Custom",
      label: trimmed.length > 42 ? trimmed.slice(0, 42) + "…" : trimmed,
      expectedStatus: "pass",
    };
    setTestCases((prev) => [...prev, newCase]);
    setCustomUrl("");
    setShowCustomInput(false);
    addLog(`Added custom URL: ${trimmed}`);
  };

  const handleRemoveCase = (index: number) => {
    setTestCases((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setTestCases(DEFAULT_TEST_CASES);
    setResults([]);
    setSummary(null);
    setLogs([]);
    setProgress(0);
    addLog("Reset to default test suite");
  };

  const handleRunAll = () => runTests(testCases, false);
  const handleRunAllWithUpdate = () => runTests(testCases, true);

  const handleRunFailed = () => {
    const failedCases = results
      .filter((r) => r.status === "fail")
      .map((r) => ({
        url: r.url,
        category: r.category,
        label: r.label ?? r.url,
        note: r.note,
        expectedStatus: "pass" as const,
      }));
    if (failedCases.length === 0) {
      Alert.alert("No Failures", "No failed tests to retry.");
      return;
    }
    addLog(`Re-running ${failedCases.length} failed test${failedCases.length !== 1 ? "s" : ""}...`);
    runTests(failedCases);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient
        colors={["#0A0A1E", C.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.4 }}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.testBadge}>
            <Feather name="terminal" size={16} color={C.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Test Mode</Text>
            {ytdlpVersion ? (
              <Text style={styles.headerSubtitle}>yt-dlp {ytdlpVersion}</Text>
            ) : (
              <Text style={styles.headerSubtitle}>Internal validation system</Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={[styles.updateBtn, (isUpdating || isRunning) && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={isUpdating || isRunning}
          >
            {isUpdating
              ? <ActivityIndicator size={12} color={C.accent} />
              : <Feather name="download" size={12} color={C.accent} />
            }
            <Text style={styles.updateBtnText}>{isUpdating ? "Updating…" : "Update"}</Text>
          </Pressable>
          <Pressable style={styles.resetBtn} onPress={handleReset}>
            <Feather name="refresh-cw" size={13} color={C.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Progress bar */}
      {isRunning && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      )}

      {/* Summary Bar */}
      {summary && (
        <Animated.View entering={FadeIn} style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#22c55e" }]}>{summary.passed}</Text>
            <Text style={styles.summaryLabel}>Pass</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#ef4444" }]}>{summary.failed}</Text>
            <Text style={styles.summaryLabel}>Fail</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#f59e0b" }]}>{summary.unsupported}</Text>
            <Text style={styles.summaryLabel}>N/A</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#8b5cf6" }]}>{summary.invalid}</Text>
            <Text style={styles.summaryLabel}>Invalid</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, {
              color: summary.successRate >= 70 ? "#22c55e" : summary.successRate >= 40 ? "#f59e0b" : "#ef4444",
            }]}>
              {summary.successRate}%
            </Text>
            <Text style={styles.summaryLabel}>Rate</Text>
          </View>
        </Animated.View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.runBtn, isRunning && styles.btnDisabled]}
          onPress={handleRunAll}
          disabled={isRunning}
        >
          {isRunning
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="play-circle" size={15} color="#fff" />
          }
          <Text style={styles.runBtnText}>
            {isRunning
              ? `Testing ${results.filter((r) => r.status !== "pending" && r.status !== "running").length}/${testCases.length}…`
              : `Run All (${testCases.length})`}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.updateRunBtn, isRunning && styles.btnDisabled]}
          onPress={handleRunAllWithUpdate}
          disabled={isRunning}
        >
          <Feather name="zap" size={13} color={C.accent} />
          <Text style={styles.updateRunBtnText}>Update + Run</Text>
        </Pressable>

        <Pressable
          style={styles.addBtn}
          onPress={() => setShowCustomInput(!showCustomInput)}
        >
          <Feather name="plus" size={14} color={C.accent} />
          <Text style={styles.addBtnText}>Add URL</Text>
        </Pressable>
      </View>

      {/* Retry failed row */}
      {summary && summary.failed > 0 && !isRunning && (
        <View style={styles.retryRow}>
          <Pressable style={styles.retryFailedBtn} onPress={handleRunFailed}>
            <Feather name="refresh-cw" size={13} color="#ef4444" />
            <Text style={styles.retryFailedText}>Retry Failed ({summary.failed})</Text>
          </Pressable>
        </View>
      )}

      {/* Custom URL Input */}
      {showCustomInput && (
        <Animated.View entering={FadeInDown} style={styles.customInputBox}>
          <TextInput
            style={styles.customInput}
            value={customUrl}
            onChangeText={setCustomUrl}
            placeholder="Paste any URL to test…"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={handleAddCustomUrl}
          />
          <TextInput
            style={[styles.customInput, { marginTop: 8 }]}
            value={customCategory}
            onChangeText={setCustomCategory}
            placeholder="Category (e.g. Custom)"
            placeholderTextColor={C.textMuted}
          />
          <Pressable style={styles.addCustomBtn} onPress={handleAddCustomUrl}>
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.addCustomBtnText}>Add to Suite</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === "results" && styles.tabBtnActive]}
          onPress={() => setActiveTab("results")}
        >
          <Feather name="list" size={13} color={activeTab === "results" ? C.accent : C.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === "results" && styles.tabBtnTextActive]}>
            Results ({results.length > 0 ? results.length : testCases.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "logs" && styles.tabBtnActive]}
          onPress={() => setActiveTab("logs")}
        >
          <Feather name="file-text" size={13} color={activeTab === "logs" ? C.accent : C.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === "logs" && styles.tabBtnTextActive]}>
            Logs ({logs.length})
          </Text>
        </Pressable>
      </View>

      {/* ── Results Tab ── */}
      {activeTab === "results" && (
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Pending queue (before run) */}
          {results.length === 0 && testCases.map((tc, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 25)} style={styles.resultCard}>
              <View style={styles.resultTop}>
                <View style={[styles.catBadge, { backgroundColor: categoryColor(tc.category) + "22", borderColor: categoryColor(tc.category) + "44" }]}>
                  <Text style={[styles.catText, { color: categoryColor(tc.category) }]}>{tc.category}</Text>
                </View>
                <Pressable onPress={() => handleRemoveCase(i)} style={styles.removeBtn}>
                  <Feather name="x" size={12} color={C.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.resultLabel}>{tc.label}</Text>
              <Text style={styles.resultUrl} numberOfLines={1}>{tc.url}</Text>
              {tc.note && <Text style={styles.noteText}>{tc.note}</Text>}
              <View style={styles.resultStatusRow}>
                <Feather name="clock" size={11} color={C.textMuted} />
                <Text style={[styles.resultStatusText, { color: C.textMuted }]}>PENDING</Text>
              </View>
            </Animated.View>
          ))}

          {/* Live / Completed Results */}
          {results.map((r, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 15)} style={styles.resultCard}>
              <View style={styles.resultTop}>
                <View style={[styles.catBadge, { backgroundColor: categoryColor(r.category) + "22", borderColor: categoryColor(r.category) + "44" }]}>
                  <Text style={[styles.catText, { color: categoryColor(r.category) }]}>{r.category}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor(r.status) + "22", borderColor: statusColor(r.status) + "44" }]}>
                  {r.status === "running"
                    ? <ActivityIndicator size={10} color={statusColor(r.status)} />
                    : <Feather name={statusIcon(r.status) as any} size={10} color={statusColor(r.status)} />
                  }
                  <Text style={[styles.statusPillText, { color: statusColor(r.status) }]}>
                    {statusLabel(r.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.resultLabel}>{r.label ?? r.url}</Text>
              <Text style={styles.resultUrl} numberOfLines={1}>{r.url}</Text>
              {r.note && <Text style={styles.noteText}>{r.note}</Text>}

              {r.title && (
                <Text style={styles.resultTitle} numberOfLines={1}>"{r.title}"</Text>
              )}

              {/* Checklist */}
              {r.status !== "pending" && r.status !== "running" && (
                <View style={styles.checklist}>
                  <CheckItem
                    ok={r.title != null}
                    label="Metadata fetched"
                    failed={r.failedStep === "metadata"}
                    detail={r.failedStep === "metadata" ? (r.errorMessage ?? undefined) : undefined}
                  />
                  <CheckItem
                    ok={r.thumbnail != null}
                    label="Thumbnail found"
                  />
                  <CheckItem
                    ok={r.hasDuration}
                    label="Duration available"
                  />
                  <CheckItem
                    ok={r.formatsAvailable > 0}
                    label={`Download formats (${r.formatsAvailable})`}
                    failed={r.failedStep === "formats"}
                    detail={r.failedStep === "formats" ? (r.errorMessage ?? undefined) : undefined}
                  />
                  <CheckItem
                    ok={r.downloadable}
                    label="Downloadable"
                    failed={r.failedStep === "formats" && !r.downloadable}
                  />
                </View>
              )}

              {/* Performance */}
              {r.totalMs > 0 && (
                <View style={styles.perfRow}>
                  <PerfChip icon="database" label="Meta" value={fmtMs(r.metadataMs)} />
                  <PerfChip icon="cpu" label="Formats" value={fmtMs(r.formatMs)} />
                  <PerfChip icon="clock" label="Total" value={fmtMs(r.totalMs)} />
                  {r.retryAttempts > 0 && (
                    <PerfChip icon="refresh-cw" label="Retries" value={String(r.retryAttempts)} warn />
                  )}
                </View>
              )}

              {/* Strategy used (shown if non-primary) */}
              {r.strategyUsed && r.strategyUsed !== "primary" && r.strategyUsed !== "default" && (
                <View style={styles.strategyRow}>
                  <Feather name="git-branch" size={10} color={C.textMuted} />
                  <Text style={styles.strategyText}>Strategy: {r.strategyUsed}</Text>
                </View>
              )}

              {/* Failed-step banner */}
              {r.failedStep && r.status === "fail" && (
                <View style={styles.failedStepBanner}>
                  <Feather name="alert-octagon" size={11} color="#ef4444" />
                  <Text style={styles.failedStepText}>{failedStepLabel(r.failedStep)}</Text>
                </View>
              )}

              {/* Error detail */}
              {r.errorMessage && r.status !== "pass" && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={11} color="#ef4444" />
                  <Text style={styles.errorBoxText}>{r.errorMessage}</Text>
                </View>
              )}

              {/* Context hints */}
              {r.status === "unsupported" && (
                <Text style={styles.suggestionText}>
                  This site is not supported by yt-dlp. Expected result for edge-case testing.
                </Text>
              )}
              {r.status === "fail" && r.errorCode === "NETWORK_ERROR" && (
                <Text style={styles.suggestionText}>
                  Network error — check that the API server is running.
                </Text>
              )}
              {r.status === "fail" && r.category === "TikTok" && (
                <Text style={styles.suggestionText}>
                  TikTok blocks most server IPs. All 3 extraction strategies were tried.
                </Text>
              )}
              {r.status === "fail" && r.category === "Instagram" && (
                <Text style={styles.suggestionText}>
                  Instagram requires login cookies for most content. Expected on server.
                </Text>
              )}
            </Animated.View>
          ))}

          {results.length === 0 && testCases.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="terminal" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No test cases</Text>
              <Text style={styles.emptySubtitle}>Add URLs above then tap Run All</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Logs Tab ── */}
      {activeTab === "logs" && (
        <ScrollView
          ref={logScrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.logContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="file-text" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No logs yet</Text>
              <Text style={styles.emptySubtitle}>Run tests to see logs here</Text>
            </View>
          ) : (
            <>
              <View style={styles.logHeader}>
                <Feather name="file-text" size={12} color={C.textMuted} />
                <Text style={styles.logHeaderText}>{logs.length} entries (newest first)</Text>
                <Pressable onPress={() => setLogs([])} style={styles.clearLogsBtn}>
                  <Text style={styles.clearLogsBtnText}>Clear</Text>
                </Pressable>
              </View>
              {logs.map((log, i) => {
                const isError = /FAIL|error|Error/.test(log);
                const isWarn = /Retry|WARN|Warning/.test(log);
                const isPass = /PASS|complete|Done/.test(log);
                const isInfo = /\[info\]|\[update\]/.test(log);
                const color = isError ? "#ef4444" : isWarn ? "#f59e0b" : isPass ? "#22c55e" : isInfo ? C.accent : C.textSecondary;
                return (
                  <View key={i} style={styles.logLine}>
                    <Text style={[styles.logText, { color }]}>{log}</Text>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CheckItem({
  ok, label, failed = false, detail,
}: {
  ok: boolean; label: string; failed?: boolean; detail?: string;
}) {
  const isFail = !ok;
  const color = ok ? "#22c55e" : failed ? "#ef4444" : C.textMuted;
  const icon = ok ? "check-circle" : failed ? "x-circle" : "minus-circle";
  return (
    <View style={[checkStyles.row, failed && checkStyles.failedRow]}>
      <Feather name={icon as any} size={12} color={color} />
      <Text style={[checkStyles.label, { color: isFail ? (failed ? "#ef4444" : C.textMuted) : color }]}>
        {label}
      </Text>
      {detail && <Text style={checkStyles.detail} numberOfLines={1}> — {detail}</Text>}
    </View>
  );
}

const checkStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  failedRow: {
    backgroundColor: "#ef444410",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  label: { fontSize: 11, flex: 1 },
  detail: { fontSize: 10, color: "#ef4444", flex: 2 },
});

function PerfChip({
  icon, label, value, warn = false,
}: {
  icon: string; label: string; value: string; warn?: boolean;
}) {
  return (
    <View style={[styles.perfChip, warn && styles.perfChipWarn]}>
      <Feather name={icon as any} size={9} color={warn ? "#f59e0b" : C.textMuted} />
      <Text style={[styles.perfChipText, warn && { color: "#f59e0b" }]}>{label}: {value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  testBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accent + "22",
    borderWidth: 1,
    borderColor: C.accent + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  headerSubtitle: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  updateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.accent + "15",
    borderWidth: 1,
    borderColor: C.accent + "33",
  },
  updateBtnText: { fontSize: 12, color: C.accent, fontWeight: "600" },
  resetBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  btnDisabled: { opacity: 0.4 },

  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: C.surface,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  progressText: { fontSize: 11, color: C.textMuted, minWidth: 32, textAlign: "right" },

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    paddingVertical: 10,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryNum: { fontSize: 18, fontWeight: "800" },
  summaryLabel: { fontSize: 9, color: C.textMuted, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.4 },
  summarySep: { width: 1, height: 24, backgroundColor: C.surfaceBorder },

  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexWrap: "wrap",
  },
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
  },
  runBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  updateRunBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.accent + "15",
    borderWidth: 1,
    borderColor: C.accent + "44",
  },
  updateRunBtnText: { color: C.accent, fontWeight: "600", fontSize: 12 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  addBtnText: { color: C.accent, fontSize: 12, fontWeight: "600" },

  retryRow: { paddingHorizontal: 16, paddingBottom: 8 },
  retryFailedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#ef444415",
    borderWidth: 1,
    borderColor: "#ef444433",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryFailedText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },

  customInputBox: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    padding: 12,
  },
  customInput: {
    backgroundColor: C.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  addCustomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 10,
  },
  addCustomBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: { backgroundColor: C.accent + "18" },
  tabBtnText: { fontSize: 13, color: C.textMuted },
  tabBtnTextActive: { color: C.accent, fontWeight: "600" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },
  logContent: { padding: 16, gap: 4 },

  resultCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    padding: 14,
    gap: 6,
  },
  resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  removeBtn: { padding: 4 },
  resultLabel: { fontSize: 14, fontWeight: "600", color: C.text },
  resultUrl: { fontSize: 11, color: C.textMuted },
  resultTitle: { fontSize: 12, color: C.textSecondary, fontStyle: "italic" },
  noteText: { fontSize: 10, color: C.textMuted, fontStyle: "italic" },
  resultStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultStatusText: { fontSize: 11 },

  checklist: { gap: 2, paddingTop: 4 },

  perfRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 4 },
  perfChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.background,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  perfChipWarn: { borderColor: "#f59e0b44", backgroundColor: "#f59e0b11" },
  perfChipText: { fontSize: 10, color: C.textMuted },

  strategyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 2,
  },
  strategyText: { fontSize: 10, color: C.textMuted, fontStyle: "italic" },

  failedStepBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef444415",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
  },
  failedStepText: { fontSize: 11, color: "#ef4444", fontWeight: "600" },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#ef444410",
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
  },
  errorBoxText: { flex: 1, fontSize: 11, color: "#ef4444", lineHeight: 16 },

  suggestionText: {
    fontSize: 11,
    color: C.textMuted,
    fontStyle: "italic",
    paddingTop: 2,
    lineHeight: 15,
  },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.textSecondary },
  emptySubtitle: { fontSize: 13, color: C.textMuted, textAlign: "center" },

  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 8,
  },
  logHeaderText: { flex: 1, fontSize: 11, color: C.textMuted },
  clearLogsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  clearLogsBtnText: { fontSize: 11, color: C.textMuted },
  logLine: { paddingVertical: 2 },
  logText: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 16 },
});
