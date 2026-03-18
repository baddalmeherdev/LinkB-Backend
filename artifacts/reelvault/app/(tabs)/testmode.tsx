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
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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
}

const DEFAULT_TEST_CASES: TestCase[] = [
  // Short-form video
  {
    url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    category: "Short-form",
    label: "YouTube Shorts",
    expectedStatus: "pass",
  },
  {
    url: "https://www.tiktok.com/@tiktok/video/7106594312292453675",
    category: "Short-form",
    label: "TikTok Video",
    expectedStatus: "pass",
  },
  // Long-form video
  {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Long-form",
    label: "YouTube Video",
    expectedStatus: "pass",
  },
  {
    url: "https://vimeo.com/76979871",
    category: "Long-form",
    label: "Vimeo Video",
    expectedStatus: "pass",
  },
  // Direct video URL
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    category: "Direct Video",
    label: "Direct MP4",
    expectedStatus: "pass",
  },
  // Invalid links
  {
    url: "not-a-url",
    category: "Invalid",
    label: "Not a URL",
    expectedStatus: "invalid",
  },
  {
    url: "https://",
    category: "Invalid",
    label: "Empty HTTPS",
    expectedStatus: "invalid",
  },
  // Unsupported links
  {
    url: "https://example.com/video.html",
    category: "Unsupported",
    label: "Random Webpage",
    expectedStatus: "unsupported",
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestResult {
  url: string;
  category: string;
  status: "pass" | "fail" | "unsupported" | "invalid" | "pending" | "running";
  errorCode: string | null;
  errorMessage: string | null;
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
    "Short-form": "#06b6d4",
    "Long-form": "#3b82f6",
    "Direct Video": "#10b981",
    "Invalid": "#8b5cf6",
    "Unsupported": "#f59e0b",
    "Custom": "#f97316",
  };
  return map[cat] ?? C.textMuted;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function TestModeScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const logScrollRef = useRef<ScrollView>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [customUrl, setCustomUrl] = useState("");
  const [customCategory, setCustomCategory] = useState("Custom");
  const [activeTab, setActiveTab] = useState<"results" | "logs">("results");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>(DEFAULT_TEST_CASES);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 499)]);
  }, []);

  const runTests = useCallback(async (cases: TestCase[]) => {
    if (isRunning) return;
    if (cases.length === 0) {
      Alert.alert("No Tests", "Add at least one URL to test.");
      return;
    }

    setIsRunning(true);
    setSummary(null);
    setLogs([]);

    // Initialize all results as pending
    const initialResults: TestResult[] = cases.map((tc) => ({
      url: tc.url,
      category: tc.category,
      label: tc.label,
      status: "pending",
      errorCode: null,
      errorMessage: null,
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

    addLog(`Starting test run: ${cases.length} URLs`);

    // Run tests in batches of 3 for live feedback
    const BATCH = 3;
    const allResults: TestResult[] = [...initialResults];

    for (let i = 0; i < cases.length; i += BATCH) {
      const batch = cases.slice(i, i + BATCH);

      // Mark batch as running
      for (let j = 0; j < batch.length; j++) {
        allResults[i + j] = { ...allResults[i + j], status: "running" };
      }
      setResults([...allResults]);

      try {
        const response = await fetch(`${BASE_URL}/api/video/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: batch.map((tc) => ({ url: tc.url, category: tc.category })),
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json() as {
          results: TestResult[];
          logs: string[];
          summary: TestSummary;
        };

        // Merge results back
        for (let j = 0; j < data.results.length; j++) {
          allResults[i + j] = {
            ...data.results[j],
            label: batch[j]?.label,
          };
        }

        for (const log of data.logs) {
          addLog(log);
        }

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addLog(`Batch error (items ${i}–${i + BATCH - 1}): ${errMsg}`);
        for (let j = 0; j < batch.length; j++) {
          allResults[i + j] = {
            ...allResults[i + j],
            status: "fail",
            errorCode: "NETWORK_ERROR",
            errorMessage: "Could not reach test server. Check your connection.",
          };
        }
      }

      setResults([...allResults]);
    }

    // Compute final summary
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
    addLog(`Test run complete: ${passed}/${allResults.length} passed (${finalSummary.successRate}% success rate)`);
    setIsRunning(false);

    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 300);
  }, [isRunning, addLog]);

  const handleAddCustomUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    const newCase: TestCase = {
      url: trimmed,
      category: customCategory || "Custom",
      label: trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed,
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
    addLog("Reset to default test suite");
  };

  const handleRunAll = () => runTests(testCases);

  const handleRunFailed = () => {
    const failedCases = results
      .filter((r) => r.status === "fail" || r.status === "unsupported")
      .map((r) => ({
        url: r.url,
        category: r.category,
        label: r.label ?? r.url,
        expectedStatus: "pass" as const,
      }));
    if (failedCases.length === 0) {
      Alert.alert("No Failed Tests", "All tests passed!");
      return;
    }
    addLog(`Re-running ${failedCases.length} failed tests...`);
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
            <Text style={styles.headerSubtitle}>Internal validation system</Text>
          </View>
        </View>
        <Pressable style={styles.resetBtn} onPress={handleReset}>
          <Feather name="refresh-cw" size={14} color={C.textMuted} />
          <Text style={styles.resetBtnText}>Reset</Text>
        </Pressable>
      </View>

      {/* Summary Bar */}
      {summary && (
        <Animated.View entering={FadeIn} style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#22c55e" }]}>{summary.passed}</Text>
            <Text style={styles.summaryLabel}>Passed</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#ef4444" }]}>{summary.failed}</Text>
            <Text style={styles.summaryLabel}>Failed</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#f59e0b" }]}>{summary.unsupported}</Text>
            <Text style={styles.summaryLabel}>Unsupported</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#8b5cf6" }]}>{summary.invalid}</Text>
            <Text style={styles.summaryLabel}>Invalid</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, {
              color: summary.successRate >= 70 ? "#22c55e" : summary.successRate >= 40 ? "#f59e0b" : "#ef4444"
            }]}>
              {summary.successRate}%
            </Text>
            <Text style={styles.summaryLabel}>Success</Text>
          </View>
        </Animated.View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.runBtn, isRunning && styles.runBtnDisabled]}
          onPress={handleRunAll}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="play-circle" size={16} color="#fff" />
          )}
          <Text style={styles.runBtnText}>
            {isRunning ? "Running Tests…" : `Run All Tests (${testCases.length})`}
          </Text>
        </Pressable>

        {summary && summary.failed > 0 && !isRunning && (
          <Pressable style={styles.retryFailedBtn} onPress={handleRunFailed}>
            <Feather name="refresh-cw" size={14} color="#ef4444" />
            <Text style={styles.retryFailedText}>Retry Failed ({summary.failed})</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.addBtn}
          onPress={() => setShowCustomInput(!showCustomInput)}
        >
          <Feather name="plus" size={14} color={C.accent} />
          <Text style={styles.addBtnText}>Add URL</Text>
        </Pressable>
      </View>

      {/* Custom URL Input */}
      {showCustomInput && (
        <Animated.View entering={FadeInDown} style={styles.customInputBox}>
          <TextInput
            style={styles.customInput}
            value={customUrl}
            onChangeText={setCustomUrl}
            placeholder="Paste URL to test..."
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
            placeholder="Category (e.g. Short-form)"
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

      {/* Results Tab */}
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
          {/* Test Queue (before run) */}
          {results.length === 0 && testCases.map((tc, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 30)} style={styles.resultCard}>
              <View style={styles.resultTop}>
                <View style={[styles.catBadge, { backgroundColor: categoryColor(tc.category) + "22", borderColor: categoryColor(tc.category) + "55" }]}>
                  <Text style={[styles.catText, { color: categoryColor(tc.category) }]}>{tc.category}</Text>
                </View>
                <Pressable onPress={() => handleRemoveCase(i)} style={styles.removeBtn}>
                  <Feather name="x" size={12} color={C.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.resultLabel}>{tc.label}</Text>
              <Text style={styles.resultUrl} numberOfLines={1}>{tc.url}</Text>
              <View style={styles.resultStatusRow}>
                <Feather name="clock" size={12} color={C.textMuted} />
                <Text style={[styles.resultStatusText, { color: C.textMuted }]}>PENDING</Text>
              </View>
            </Animated.View>
          ))}

          {/* Live / Completed Results */}
          {results.map((r, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 20)} style={styles.resultCard}>
              <View style={styles.resultTop}>
                <View style={[styles.catBadge, { backgroundColor: categoryColor(r.category) + "22", borderColor: categoryColor(r.category) + "55" }]}>
                  <Text style={[styles.catText, { color: categoryColor(r.category) }]}>{r.category}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusColor(r.status) + "22", borderColor: statusColor(r.status) + "55" }]}>
                  {r.status === "running" ? (
                    <ActivityIndicator size={10} color={statusColor(r.status)} />
                  ) : (
                    <Feather name={statusIcon(r.status) as any} size={10} color={statusColor(r.status)} />
                  )}
                  <Text style={[styles.statusPillText, { color: statusColor(r.status) }]}>
                    {statusLabel(r.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.resultLabel}>{r.label ?? r.url}</Text>
              <Text style={styles.resultUrl} numberOfLines={1}>{r.url}</Text>

              {r.title && (
                <Text style={styles.resultTitle} numberOfLines={1}>"{r.title}"</Text>
              )}

              {/* Checklist */}
              {r.status !== "pending" && r.status !== "running" && (
                <View style={styles.checklist}>
                  <CheckItem
                    ok={r.title != null}
                    label="Metadata loaded"
                    detail={r.title ? undefined : r.errorMessage ?? undefined}
                  />
                  <CheckItem
                    ok={r.thumbnail != null}
                    label="Thumbnail available"
                  />
                  <CheckItem
                    ok={r.hasDuration}
                    label="Duration found"
                  />
                  <CheckItem
                    ok={r.formatsAvailable > 0}
                    label={`Download formats (${r.formatsAvailable})`}
                  />
                  <CheckItem
                    ok={r.downloadable}
                    label="Downloadable"
                    detail={!r.downloadable && r.errorCode ? r.errorCode : undefined}
                  />
                </View>
              )}

              {/* Performance */}
              {r.totalMs > 0 && (
                <View style={styles.perfRow}>
                  <PerfChip icon="database" label="Meta" value={formatMs(r.metadataMs)} />
                  <PerfChip icon="cpu" label="Formats" value={formatMs(r.formatMs)} />
                  <PerfChip icon="clock" label="Total" value={formatMs(r.totalMs)} />
                  {r.retryAttempts > 0 && (
                    <PerfChip icon="refresh-cw" label="Retries" value={String(r.retryAttempts)} warn />
                  )}
                </View>
              )}

              {/* Error */}
              {r.errorMessage && r.status !== "pass" && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={11} color="#ef4444" />
                  <Text style={styles.errorBoxText}>{r.errorMessage}</Text>
                </View>
              )}

              {/* Suggestions for failures */}
              {r.status === "fail" && r.errorCode === "NO_FORMATS" && (
                <Text style={styles.suggestionText}>
                  Tip: Metadata loaded but formats unavailable. This may be a geo-restricted or DRM-protected video.
                </Text>
              )}
              {r.status === "unsupported" && (
                <Text style={styles.suggestionText}>
                  This site is not supported by yt-dlp. Try a different platform.
                </Text>
              )}
              {r.status === "fail" && r.errorCode === "NETWORK_ERROR" && (
                <Text style={styles.suggestionText}>
                  Network error — check that the API server is running and reachable.
                </Text>
              )}
            </Animated.View>
          ))}

          {results.length === 0 && testCases.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="terminal" size={40} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No test cases</Text>
              <Text style={styles.emptySubtitle}>Add URLs above then tap Run All Tests</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Logs Tab */}
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
                <Text style={styles.logHeaderText}>{logs.length} log entries (newest first)</Text>
                <Pressable onPress={() => setLogs([])} style={styles.clearLogsBtn}>
                  <Text style={styles.clearLogsBtnText}>Clear</Text>
                </Pressable>
              </View>
              {logs.map((log, i) => {
                const isError = log.includes("FAIL") || log.includes("error") || log.includes("Error");
                const isWarn = log.includes("Retry") || log.includes("WARN");
                const isPass = log.includes("PASS") || log.includes("complete");
                const color = isError ? "#ef4444" : isWarn ? "#f59e0b" : isPass ? "#22c55e" : C.textSecondary;
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

function CheckItem({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <View style={styles.checkItem}>
      <Feather
        name={ok ? "check-circle" : "x-circle"}
        size={12}
        color={ok ? "#22c55e" : "#ef4444"}
      />
      <Text style={[styles.checkLabel, { color: ok ? C.textSecondary : "#ef4444" }]}>{label}</Text>
      {detail && <Text style={styles.checkDetail}> — {detail}</Text>}
    </View>
  );
}

function PerfChip({
  icon, label, value, warn = false
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  testBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accent + "22",
    borderWidth: 1,
    borderColor: C.accent + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  headerSubtitle: { fontSize: 12, color: C.textMuted },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  resetBtnText: { fontSize: 12, color: C.textMuted },

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    paddingVertical: 10,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryNum: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 9, color: C.textMuted, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 },
  summarySep: { width: 1, height: 28, backgroundColor: C.surfaceBorder },

  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexWrap: "wrap",
  },
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
  },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  retryFailedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef444422",
    borderWidth: 1,
    borderColor: "#ef444455",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryFailedText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.accent + "22",
    borderWidth: 1,
    borderColor: C.accent + "44",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addBtnText: { color: C.accent, fontSize: 13, fontWeight: "600" },

  customInputBox: {
    marginHorizontal: 16,
    marginBottom: 4,
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
    gap: 6,
    marginTop: 10,
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    alignSelf: "flex-end",
  },
  addCustomBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
    paddingHorizontal: 16,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  tabBtnActive: { borderBottomColor: C.accent },
  tabBtnText: { fontSize: 13, color: C.textMuted, fontWeight: "500" },
  tabBtnTextActive: { color: C.accent },

  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 10 },
  logContent: { padding: 12 },

  resultCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    padding: 14,
    gap: 6,
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  removeBtn: { padding: 4 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  resultLabel: { fontSize: 13, fontWeight: "600", color: C.text },
  resultUrl: { fontSize: 11, color: C.textMuted },
  resultTitle: { fontSize: 12, color: C.accent, fontStyle: "italic" },
  resultStatusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  resultStatusText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },

  checklist: { gap: 4, marginTop: 4 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkLabel: { fontSize: 11 },
  checkDetail: { fontSize: 10, color: "#ef4444" },

  perfRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 4,
  },
  perfChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.background,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  perfChipWarn: {
    borderColor: "#f59e0b55",
    backgroundColor: "#f59e0b11",
  },
  perfChipText: { fontSize: 9, color: C.textMuted },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#ef444411",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ef444433",
    padding: 8,
    marginTop: 2,
  },
  errorBoxText: { fontSize: 11, color: "#ef4444", flex: 1 },
  suggestionText: { fontSize: 11, color: C.textMuted, fontStyle: "italic", marginTop: 2 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.textSecondary },
  emptySubtitle: { fontSize: 13, color: C.textMuted, textAlign: "center" },

  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  logHeaderText: { fontSize: 11, color: C.textMuted, flex: 1 },
  clearLogsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: C.surface,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  clearLogsBtnText: { fontSize: 11, color: C.textMuted },
  logLine: {
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder + "55",
  },
  logText: { fontSize: 11, fontFamily: Platform.OS === "web" ? "monospace" : undefined },
});
