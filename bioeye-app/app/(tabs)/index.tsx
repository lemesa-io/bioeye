import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Markdown from 'react-native-markdown-display';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

const CONFIG = {
  // Set EXPO_PUBLIC_API_URL in your .env, or default to local FastAPI dev server
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000"
};

export default function HomeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [triageTier, setTriageTier] = useState<number | null>(null);
  const [tierLabel, setTierLabel] = useState<string | null>(null);
  const [qualityInsufficient, setQualityInsufficient] = useState<boolean>(false);

  // NEW: Check for an active persisted token on app initialization
  React.useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await SecureStore.getItemAsync('user_session_token');
        if (token) {
          setUserToken(token); // Auto-authenticate if found in device keychain
          console.log("Secure identity token loaded from local storage matrix.");
        }
      } catch (e) {
        console.error("Failed to restore secure session from storage registry:", e);
      }
    };

    bootstrapAsync();
  }, []);

  const handleAuthAction = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Validation Error", "Please fill out both username and password fields.");
      return;
    }

    setAuthLoading(true);
    try {
      // 1. Prepare HTML Form encoding parameters for FastAPI's login protocol
      const details: Record<string, string> = {
        'username': username.trim(),
        'password': password.trim(),
      };

      const formBody = Object.keys(details)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key]))
        .join('&');

      if (isLoginView) {
        // LOGIN EXECUTION - Explicitly requires x-www-form-urlencoded
        const response = await fetch(`${CONFIG.BASE_URL}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: formBody,
        });

        const data = await response.json();
        if (response.ok && data.access_token) {
          await SecureStore.setItemAsync('user_session_token', data.access_token);
          setUserToken(data.access_token);
          setPassword('');
        } else {
          Alert.alert("Authentication Failed", data.detail || "Invalid credential parameters.");
        }
      } else {
        // SIGNUP EXECUTION - Explicitly requires application/json
        const response = await fetch(`${CONFIG.BASE_URL}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim(),
          }),
        });

        const data = await response.json();
        if (response.ok) {
          Alert.alert("Success", "Account created successfully! Please sign in.");
          setIsLoginView(true);
          setPassword('');
        } else {
          Alert.alert("Registration Error", data.detail || "Could not register account.");
        }
      }
    } catch (error) {
      console.error("Auth server connection fault:", error);
      Alert.alert("Connection Failure", "Could not negotiate verification with secure auth gate.");
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${CONFIG.BASE_URL}/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setHistoryRecords(data.records);
      }
    } catch (error) {
      console.error("Failed to compile historical telemetry sync:", error);
    }
  };

  const toggleHistoryView = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'BioEye needs camera access to capture Bristol samples.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
      setAnalysisResult(null); // <-- Ensure this is explicitly cleared!
      setTriageTier(null);
      setTierLabel(null);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "BioEye needs access to your photos to analyze samples.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setAnalysisResult(null);
    }
  };

  const analyzeSample = async () => {
    if (!image) return;
    
    setIsProcessing(true);

    try {
      const uploadResult = await FileSystem.uploadAsync(
        `${CONFIG.BASE_URL}/analyze`,
        image,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: (FileSystem as any).FileSystemUploadType?.MULTIPART ?? (FileSystem as any).UploadType?.MULTIPART ?? 1,
          headers: {
            Accept: 'application/json',
            ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          },
        }
      );

      if (uploadResult.status !== 200) {
        throw new Error(`Server returned status ${uploadResult.status}: ${uploadResult.body}`);
      }

      let result;
      try {
        result = JSON.parse(uploadResult.body);
      } catch (parseError) {
        throw new Error("Failed to parse response JSON matrix.");
      }

      if (result && result.success) {
        setAnalysisResult(result.analysis);
        
        // Wire up the backend metrics payload directly to your component state
        if (result.metrics) {
          setTriageTier(result.metrics.tier);
          setTierLabel(result.metrics.tier_label);
          setQualityInsufficient(result.metrics.quality_insufficient);
        }
      } else if (result && result.error_type) {
        setAnalysisResult(result.analysis);
        // Handle fallback metrics states during API errors
        setTriageTier(1);
        setTierLabel("FAULT ENCOUNTERED");
        setQualityInsufficient(false);
      } else {
        Alert.alert("Pipeline Failure", "An unhandled structure was returned from the host backend.");
      }

    } catch (error) {
      console.error("Network transport fault:", error);
      Alert.alert(
        "Connection Failure", 
        "Could not reach the BioEye backend server. Verify network topology and host execution status."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (!userToken) {
    return (
      <View style={styles.container}>
        <View style={styles.authCard}>
          <Text style={styles.title}>BioEye Security Gate</Text>
          <Text style={styles.subtitle}>{isLoginView ? "Sign In to Access Triage Engine" : "Create a Secure Access Account"}</Text>
          
          <TextInput
            style={styles.authInput}
            placeholder="Username"
            placeholderTextColor="#64748B"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TextInput
            style={styles.authInput}
            placeholder="Password"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TouchableOpacity style={styles.authButton} onPress={handleAuthAction} disabled={authLoading}>
            {authLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.authButtonText}>{isLoginView ? "Login" : "Register Account"}</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setIsLoginView(!isLoginView)}>
            <Text style={{ color: '#0EA5E9', textAlign: 'center', fontSize: 14 }}>
              {isLoginView ? "Need an account? Sign Up" : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.title}>BioEye Portal</Text>
        <Text style={styles.subtitle}>Secure Gastrointestinal Triage Engine</Text>
        
        {/* Row Container for Utility Control Actions */}
        <View style={styles.headerControlsRow}>
          <TouchableOpacity style={styles.historyToggleButton} onPress={toggleHistoryView}>
            <Text style={styles.historyToggleButtonText}>
              {showHistory ? "← Back to Workspace" : "📋 View Stored Reports"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              // NEW: Evict the session keys from the hardware keychain
                await SecureStore.deleteItemAsync('user_session_token');

              // Clear the active session tokens and view state from memory
              setUserToken(null);
              setShowHistory(false);
              setAnalysisResult(null);
              setImage(null);
            }}
          >
            <Text style={styles.logoutButtonText}>🚪 Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content / Image Preview & Report Display */}
      <View style={styles.previewContainer}>
        {showHistory ? (
          // HISTORY LIST PANEL
          <ScrollView style={styles.reportCard} contentContainerStyle={styles.reportContent}>
            <Text style={styles.reportHeader}>Stored Telemetry Logs</Text>
            <View style={styles.divider} />
            
            {historyRecords.length === 0 && (
              <Text style={styles.placeholderText}>No history profiles found in local database file.</Text>
            )}

            {historyRecords.length > 0 && historyRecords.map((record) => {
              const utcString = record.created_at.endsWith('Z') ? record.created_at : `${record.created_at}Z`;
              const dateObj = new Date(utcString);
              
              const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
              const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const displayTimestamp = `${formattedDate} ${formattedTime}`;

              return (
                <TouchableOpacity 
                  key={record.id} 
                  style={styles.historyItem}
                  onPress={() => {
                    setAnalysisResult(record.analysis);
                    setShowHistory(false);
                  }}
                >
                  <View style={styles.historyMeta}>
                    <Text style={styles.historyFilename} numberOfLines={1}>{record.filename}</Text>
                    <Text style={styles.historyStatus}>
                      {record.success ? "🟢 Clear" : "🔴 Faulted"}
                    </Text>
                  </View>
                  <Text style={styles.historyTimestamp}>
                    {displayTimestamp}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : !analysisResult ? (
          image ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              
              {/* ALWAYS OBFUSCATE AS SOON AS SELECTED */}
              <View style={styles.loadingOverlay}>
                {isProcessing ? (
                  <>
                    <ActivityIndicator size="large" color="#0EA5E9" />
                    <Text style={styles.loadingText}>Streaming Asset Matrix...</Text>
                    <Text style={styles.loadingSubtext}>Analyzing triage compliance vectors via Gemini</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 36, marginBottom: 10 }}>👁️‍🗨️</Text>
                    <Text style={styles.loadingText}>Privacy Filter Active</Text>
                    <Text style={styles.loadingSubtext}>Asset matrix staged securely for backend processing.</Text>
                  </>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>No sample selected</Text>
              <Text style={styles.placeholderSubtext}>Tap below to source an image</Text>
            </View>
          )
        ) : (
          // CURRENT MATRIX ANALYSIS VIEW (The image can optionally be displayed here, or hidden)
          <ScrollView style={styles.reportCard} contentContainerStyle={styles.reportContent}>
            
            {/* NEW: Optional Small Privacy-Blurred Thumbnail for Report Reference */}
            {image && (
              <View style={styles.thumbnailWrapper}>
                <Image source={{ uri: image }} style={styles.privacyThumbnail} />
                <View style={styles.privacyOverlayMask}>
                  <Text style={styles.privacyOverlayText}>👁️ Privacy Filter Active</Text>
                </View>
              </View>
            )}

            <Text style={styles.reportHeader}>Engine Output Matrix</Text>
            <View style={styles.divider} />
            
            {/* Triage Alert Banner */}
            {triageTier && (
              <View style={[
                styles.triageBanner,
                triageTier === 1 && { backgroundColor: '#065F46', borderColor: '#059669' },
                triageTier === 2 && { backgroundColor: '#92400E', borderColor: '#D97706' },
                triageTier === 3 && { backgroundColor: '#991B1B', borderColor: '#DC2626' },
              ]}>
                <Text style={styles.triageBannerTitle}>
                  ⚠️ STATE STATUS: {tierLabel}
                </Text>
                <Text style={styles.triageBannerSubtitle}>
                  {triageTier === 3 
                    ? "CRITICAL: Vascular markers or absolute depigmentation flagged. Defer to evaluation." 
                    : triageTier === 2 
                    ? "MONITOR: Atypical structural or lipid tracking deviations noted."
                    : "STANDARD: Visual parameters clear of warning track matches."}
                </Text>
              </View>
            )}

            <Markdown style={markdownStyles}>{analysisResult}</Markdown>
          </ScrollView>
        )}
      </View>

      {/* Action Controls Section */}
      <View style={styles.controls}>
        <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: image ? 10 : 0 }}>
          <TouchableOpacity
            style={[styles.secondaryButton, { flex: 1 }]}
            onPress={takePhoto}
            disabled={isProcessing}
          >
            <Text style={styles.secondaryButtonText}>
              📷 Take Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { flex: 1 }]}
            onPress={pickImage}
            disabled={isProcessing}
          >
            <Text style={styles.secondaryButtonText}>
              {image ? "🖼️ Library" : "🖼️ Choose File"}
            </Text>
          </TouchableOpacity>
        </View>

        {image && (
          <TouchableOpacity 
            style={[styles.primaryButton, isProcessing && styles.disabledButton]} 
            onPress={analyzeSample}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Analyze Sample</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  placeholderBox: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderSubtext: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
  },
  controls: {
    marginBottom: 30,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#0369A1',
    opacity: 0.7,
  },
  reportCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '100%',
  },
  reportContent: {
    padding: 20,
  },
  reportHeader: {
    color: '#0EA5E9',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginBottom: 16,
  },
  reportText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'System',
  },
  imageWrapper: {
    width: '100%',
    height: 320, // or your existing preview height
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10,
  },
  loadingText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  loadingSubtext: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
  headerControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  historyToggleButton: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  historyToggleButtonText: {
    color: '#0EA5E9',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#1E293B',
    borderColor: '#F43F5E', // Muted crimson accent border for destructive action cues
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  logoutButtonText: {
    color: '#F43F5E',
    fontSize: 13,
    fontWeight: '600',
  },
  historyItem: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMeta: {
    flex: 1,
    marginRight: 12,
  },
  historyFilename: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  historyStatus: {
    fontSize: 11,
    marginTop: 4,
  },
  historyTimestamp: {
    color: '#64748B',
    fontSize: 12,
  },
  authCard: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    justifyContent: 'center',
    marginTop: '30%',
  },
  authInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    color: '#F8FAFC',
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  authButton: {
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  triageBanner: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  triageBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  triageBannerSubtitle: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  thumbnailWrapper: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  privacyThumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.15, // Drastically lowers visual impact immediately
  },
  privacyOverlayMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 41, 59, 0.7)', // Slate blending fill
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyOverlayText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  }
});

const markdownStyles = {
  body: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 24,
  },
  heading3: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  strong: {
    color: '#F43F5E',
    fontWeight: '700' as const,
  },
  paragraph: {
    marginBottom: 12,
  },
};
