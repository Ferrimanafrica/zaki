import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Platform } from "react-native";
const ConfettiCannon =
  Platform.OS === "web" ? (() => null) : require("react-native-confetti-cannon").default;
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./CheckoutScreen";
import { LinearGradient } from "expo-linear-gradient";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import type { CartItem } from "../context/CartContext";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ConfirmationScreen"
>;

type RouteProps = RouteProp<RootStackParamList, "ConfirmationScreen">;

import { useLocalSearchParams, router } from "expo-router";

const ConfirmationScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const confettiRef = useRef<any>(null);

  let { reference = "N/A", amount = 0, cart = [] } = params as any;

  if (typeof cart === "string") {
    try {
      cart = JSON.parse(cart);
    } catch {
      cart = [];
    }
  }
  
  const cartItems = cart as CartItem[];

  // Fallback for amount if it comes as string
  if (typeof amount === "string") {
    amount = parseFloat(amount) || 0;
  }

  useEffect(() => {
    confettiRef.current?.start();
  }, []);

  const computedTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const handleDownloadReceipt = async () => {
    const dateStr = new Date().toLocaleString();
    const rows = cartItems
      .map(
        (i) =>
          `<tr>
             <td style="padding:8px;border-bottom:1px solid #eee;">${i.name}</td>
             <td style="padding:8px;border-bottom:1px solid #eee;">${i.quantity}</td>
             <td style="padding:8px;border-bottom:1px solid #eee;">₦${i.price.toLocaleString()}</td>
             <td style="padding:8px;border-bottom:1px solid #eee;">₦${(i.price * i.quantity).toLocaleString()}</td>
           </tr>`
      )
      .join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt</title>
        </head>
        <body style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:16px; color:#041330;">
          <div style="text-align:center; margin-bottom:16px;">
            <h2 style="margin:0;color:#FB7C00;">FERRIMANI Receipt</h2>
            <p style="margin:4px 0;">${dateStr}</p>
            <p style="margin:4px 0;">Reference: <strong>${reference}</strong></p>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f8f8f8;">
                <th style="text-align:left;padding:8px;">Item</th>
                <th style="text-align:left;padding:8px;">Qty</th>
                <th style="text-align:left;padding:8px;">Unit Price</th>
                <th style="text-align:left;padding:8px;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div style="margin-top:16px; text-align:right;">
            <h3 style="margin:0;">Total Paid: ₦${(amount || computedTotal).toLocaleString()}</h3>
          </div>
          <p style="margin-top:20px; text-align:center; font-size:12px; color:#777;">
            Thank you for shopping with Ferrimani.
          </p>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        UTI: "com.adobe.pdf",
        mimeType: "application/pdf",
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#041330", "#0A1C3E"]} style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Order Confirmation</Text>
          <TouchableOpacity onPress={handleDownloadReceipt} style={styles.iconBtn}>
            <MaterialIcons name="download" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>Reference: {reference}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <ConfettiCannon
          count={200}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut
          ref={confettiRef}
        />

        <View style={styles.circle}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.title}>Payment Successful 🎉</Text>
        <Text style={styles.subtitle}>Thank you for your purchase!</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Paid</Text>
            <Text style={styles.summaryValue}>₦{(amount || computedTotal).toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Items Purchased</Text>
        <FlatList<CartItem>
          data={cart}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  Qty: {item.quantity} • Unit: ₦{item.price.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                ₦{(item.price * item.quantity).toLocaleString()}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.push("/")}
        >
          <MaterialIcons name="home" size={20} color="#FFFFFF" />
          <Text style={styles.homeBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ConfirmationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  headerGradient: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  headerSub: { color: "#98A2B3", marginTop: 4 },
  iconBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: 8,
    borderRadius: 8,
  },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#4BB543",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    alignSelf: "center",
  },
  checkmark: {
    fontSize: 60,
    color: "white",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#041330",
  },
  subtitle: {
    fontSize: 15,
    color: "#667085",
    textAlign: "center",
    marginTop: 6,
  },
  summaryCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: "#667085", fontSize: 14 },
  summaryValue: { color: "#FB7C00", fontSize: 18, fontWeight: "700" },
  sectionTitle: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: "700",
    color: "#041330",
  },
  itemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  itemName: { color: "#041330", fontSize: 14, fontWeight: "600" },
  itemMeta: { color: "#667085", marginTop: 4 },
  itemTotal: { color: "#041330", fontWeight: "700" },
  homeBtn: {
    marginTop: 24,
    backgroundColor: "#FB7C00",
    borderRadius: 28,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  homeBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginLeft: 6 },
});