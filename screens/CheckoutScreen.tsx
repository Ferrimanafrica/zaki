// screens/CheckoutScreen.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
// Avoid importing native Picker on web; dynamically require only on native
const RNPicker =
  Platform.OS === "web" ? null : require("@react-native-picker/picker");
const Picker = RNPicker ? RNPicker.Picker : null;
import countryList from "react-select-country-list";
import { useCart } from "../context/CartContext";
import type { CartItem } from "../context/CartContext";
// Avoid importing Paystack hook on web; dynamically require only on native
const usePaystack =
  Platform.OS === "web"
    ? null
    : require("react-native-paystack-webview").usePaystack;

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type RootStackParamList = {
  Home: undefined;
  Cart: undefined;
  ProductDetail: undefined;
  CheckoutScreen: undefined;
  ConfirmationScreen: {
    reference: string;
    amount: number;
    cart: CartItem[];
  };
};

const navigateExternal = (url: string) => {
  try {
    (window as any).location.href = url;
    return;
  } catch {}
  try {
    (window as any).location.assign(url);
    return;
  } catch {}
  try {
    (window as any).location.replace(url);
    return;
  } catch {}
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_self";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  } catch {}
};

export default function CheckoutScreen() {
  const { cart, total } = useCart();
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  const { popup } = usePaystack
    ? usePaystack()
    : { popup: { checkout: (_: any) => {} } };

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const countries = countryList().getData(); // { value, label } items
  const finalTotal = total + (deliveryFee ?? 0);
  const publicKey = useMemo(() => {
    const envKey =
      (typeof process !== "undefined" &&
        (process as any).env &&
        (process as any).env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY) ||
      "";
    return envKey;
  }, []);
  const apiBase = useMemo(() => {
    const envBase =
      (typeof process !== "undefined" &&
        (process as any).env &&
        (process as any).env.EXPO_PUBLIC_API_BASE_URL) ||
      "";
    if (envBase) return envBase;
    return "https://us-central1-ferrimani-backend.cloudfunctions.net/api";
  }, []);

  useEffect(() => {}, []);

  const verifyPayment = async (reference: string) => {
    try {
      const res = await fetch(`${apiBase}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, amount: finalTotal }),
      });
      const result = await res.json();
      if (result && result.ok) {
        navigation.replace("ConfirmationScreen", {
          reference,
          amount: finalTotal,
          cart,
        });
      } else {
        Alert.alert("Verification failed");
      }
    } catch {
      Alert.alert("Verification error");
    }
  };

  const AFRICAN_COUNTRIES = useMemo(
    () =>
      new Set([
        "Algeria",
        "Angola",
        "Benin",
        "Botswana",
        "Burkina Faso",
        "Burundi",
        "Cabo Verde",
        "Cameroon",
        "Central African Republic",
        "Chad",
        "Comoros",
        "Congo",
        "Democratic Republic of the Congo",
        "Djibouti",
        "Egypt",
        "Equatorial Guinea",
        "Eritrea",
        "Eswatini",
        "Ethiopia",
        "Gabon",
        "Gambia",
        "Ghana",
        "Guinea",
        "Guinea-Bissau",
        "Ivory Coast",
        "Kenya",
        "Lesotho",
        "Liberia",
        "Libya",
        "Madagascar",
        "Malawi",
        "Mali",
        "Mauritania",
        "Mauritius",
        "Morocco",
        "Mozambique",
        "Namibia",
        "Niger",
        "Nigeria",
        "Rwanda",
        "Sao Tome and Principe",
        "Senegal",
        "Seychelles",
        "Sierra Leone",
        "Somalia",
        "South Africa",
        "South Sudan",
        "Sudan",
        "Tanzania",
        "Togo",
        "Tunisia",
        "Uganda",
        "Zambia",
        "Zimbabwe",
      ]),
    []
  );

  const getFees = useCallback(
    (c: string) => {
      const cc = String(c || "").trim();
      if (!cc) return { pickup: 0, doorstep: 0 };
      if (cc === "Nigeria") return { pickup: 5000, doorstep: 8000 };
      if (cc === "Ghana") return { pickup: 20000, doorstep: 30000 };
      if (AFRICAN_COUNTRIES.has(cc)) return { pickup: 26000, doorstep: 36000 };
      return { pickup: 45000, doorstep: 58000 };
    },
    [AFRICAN_COUNTRIES]
  );

  const fees = useMemo(() => getFees(country), [country, getFees]);
  const effectiveFees = useMemo(
    () => (couponApplied ? { pickup: 0, doorstep: 0 } : fees),
    [couponApplied, fees]
  );

  const isFormValid =
    phone.trim().length > 0 &&
    email.trim().length > 0 &&
    country.trim().length > 0 &&
    deliveryFee !== null &&
    cart.length > 0;

  // fetch states for selected country (countriesnow.space API)
  const fetchStates = async (countryName: string) => {
    if (!countryName) {
      setAvailableStates([]);
      setState("");
      return;
    }

    setLoadingStates(true);
    setAvailableStates([]);
    setState("");

    try {
      const res = await fetch(
        "https://countriesnow.space/api/v0.1/countries/states",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: countryName }),
        }
      );
      const json = await res.json();

      // API returns data.states as array of objects: { name: "State Name" }
      let states: string[] = [];
      if (json && json.data && Array.isArray(json.data.states)) {
        states = json.data.states.map((s: any) => s.name || s);
      } else if (json && json.data && Array.isArray(json.data)) {
        // fallback if different shape
        states = json.data.map((s: any) => (s.name ? s.name : s));
      }

      setAvailableStates(states);
    } catch (err) {
      console.warn("Could not fetch states for", countryName, err);
      setAvailableStates([]);
    } finally {
      setLoadingStates(false);
    }
  };

  // effect: fetch states when country changes
  useEffect(() => {
    if (country) fetchStates(country);
    else {
      setAvailableStates([]);
      setState("");
    }
  }, [country]);

  // restore coupon from storage
  useEffect(() => {
    (async () => {
      try {
        let stored = "";
        if (Platform.OS === "web") {
          stored = (window.localStorage.getItem("ferrimani_coupon") || "").trim();
        } else {
          stored = (await AsyncStorage.getItem("ferrimani_coupon")) || "";
        }
        const normalized = stored.trim().toLowerCase();
        if (normalized === "big ferrimani") {
          setCoupon(stored);
          setCouponApplied(true);
          setDeliveryFee(0);
          setCouponMessage("Promo code applied successfully. Free delivery activated.");
        }
      } catch {}
    })();
  }, []);

  const applyCoupon = useCallback(async () => {
    const normalized = String(coupon || "").trim().toLowerCase();
    if (normalized === "big ferrimani") {
      setDeliveryFee(0);
      setCouponApplied(true);
      setCouponMessage("Promo code applied successfully. Free delivery activated.");
      try {
        if (Platform.OS === "web") {
          window.localStorage.setItem("ferrimani_coupon", coupon.trim());
        } else {
          await AsyncStorage.setItem("ferrimani_coupon", coupon.trim());
        }
      } catch {}
    } else {
      setCouponApplied(false);
      setDeliveryFee(null);
      setCouponMessage("Invalid promo code.");
      try {
        if (Platform.OS === "web") {
          window.localStorage.removeItem("ferrimani_coupon");
        } else {
          await AsyncStorage.removeItem("ferrimani_coupon");
        }
      } catch {}
    }
  }, [coupon]);

  const handleCheckout = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (!isFormValid) {
        Alert.alert("Please fill all required fields.");
        return;
      }

      const reference = `TXN_${Date.now()}`;
      if (Platform.OS === "web") {
      const init = await fetch(`${apiBase}/initialize-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: finalTotal,
          reference,
          metadata: { cart, deliveryFee, additionalInfo, phone, country, state },
        }),
      });
      const res = await init.json();
      if (res?.ok && res?.data?.authorization_url) {
        navigateExternal(res.data.authorization_url);
        return;
      }
      Alert.alert("Payment failed to initialize");
      return;
      }

    // Native (mobile)
    if (publicKey && popup && typeof popup.checkout === "function") {
      popup.checkout({
        email,
        amount: finalTotal,
        reference,
        metadata: { cart, deliveryFee, additionalInfo, phone, country, state },
        onSuccess: async (res: { reference: string }) => {
          await verifyPayment(res.reference);
        },
        onCancel: () => Alert.alert("❌ Payment Cancelled"),
        onError: (err: unknown) => {
          Alert.alert("Error", "Something went wrong with Paystack.");
        },
      });
      return;
    }

      const init = await fetch(`${apiBase}/initialize-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: finalTotal,
          reference,
          metadata: { cart, deliveryFee, additionalInfo, phone, country, state },
        }),
      });
      const res = await init.json();
      if (res && res.ok && res.data && res.data.authorization_url) {
        await WebBrowser.openBrowserAsync(res.data.authorization_url);
        return;
      }
      const msg =
        (res && res.error) ||
        "Unable to start payment. Please check your Paystack keys and backend.";
      Alert.alert(String(msg));
    } catch {
      Alert.alert("Payment initialization failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.header}>Checkout</Text>

        <Text style={styles.sectionTitle}>Billing Details</Text>

        <View style={styles.row}>
          <TextInput style={[styles.halfInput]} placeholder="First Name *" />
          <TextInput style={[styles.halfInput, styles.lastInRow]} placeholder="Last Name *" />
        </View>

        <TextInput style={styles.input} placeholder="Company Name (Optional)" />

        <TextInput
          style={styles.input}
          placeholder="Phone Number *"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Email Address *"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {Platform.OS !== "web" && Picker ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={country}
              onValueChange={(value: any) => {
                setCountry(value);
              }}
              style={styles.pickerStyle}
            >
              <Picker.Item label="Select Country *" value="" />
              {countries.map((c: any) => (
                <Picker.Item key={c.value} label={c.label} value={c.label} />
              ))}
            </Picker>
          </View>
        ) : (
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setCountryOpen(!countryOpen)}
            >
              <Text style={{ color: country ? "#041330" : "#999" }}>
                {country || "Select Country *"}
              </Text>
            </TouchableOpacity>
            {countryOpen && (
              <View style={styles.dropdownList}>
                <ScrollView style={{ maxHeight: 220 }}>
                  {countries.map((c: any) => (
                    <TouchableOpacity
                      key={c.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCountry(c.label);
                        setCountryOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        <View style={{ marginBottom: 12 }}>
          {loadingStates ? (
            <View style={[styles.pickerContainer, styles.centerItems]}>
              <ActivityIndicator size="small" />
            </View>
          ) : availableStates && availableStates.length > 0 ? (
            Platform.OS !== "web" && Picker ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={state}
                  onValueChange={(value: any) => setState(value)}
                  style={styles.pickerStyle}
                >
                  <Picker.Item label="Select State *" value="" />
                  {availableStates.map((s) => (
                    <Picker.Item key={s} label={s} value={s} />
                  ))}
                </Picker>
              </View>
            ) : (
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setStateOpen(!stateOpen)}
                >
                  <Text style={{ color: state ? "#041330" : "#999" }}>
                    {state || "Select State / Province *"}
                  </Text>
                </TouchableOpacity>
                {stateOpen && (
                  <View style={styles.dropdownList}>
                    <ScrollView style={{ maxHeight: 220 }}>
                      {availableStates.map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setState(s);
                            setStateOpen(false);
                          }}
                        >
                          <Text style={styles.dropdownText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )
          ) : country ? (
            <TextInput
              style={styles.input}
              placeholder="State / Province *"
              value={state}
              onChangeText={setState}
            />
          ) : null}
        </View>

        <TextInput style={styles.input} placeholder="Street Address *" />
        <TextInput style={styles.input} placeholder="Apartment, suite, etc. (Optional)" />
        <TextInput style={styles.input} placeholder="City *" />

        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Additional Information (Optional)"
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          multiline
        />

        <Text style={styles.sectionTitle}>Coupon Code</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.halfInput, { flex: 2 }]}
            placeholder="Enter Promo Code"
            value={coupon}
            onChangeText={setCoupon}
          />
          <TouchableOpacity style={[styles.applyBtn, styles.lastInRow]} onPress={applyCoupon}>
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
        </View>
        {couponMessage ? (
          <Text style={[styles.helperText, { color: couponApplied ? "green" : "red" }]}>{couponMessage}</Text>
        ) : null}

        <Text style={styles.sectionTitle}>Your Order</Text>
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>Product</Text>
            <Text style={styles.summaryText}>Subtotal</Text>
          </View>

          {cart.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Image source={{ uri: item.image }} style={styles.itemImage} />
                <Text style={styles.itemText}>
                  {item.name} × {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemText}>
                ₦{(item.price * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}

          {country ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Delivery Options</Text>
              {couponApplied ? (
                <Text style={[styles.helperText, { color: "green" }]}>
                  Free delivery is active. Delivery fee will be ₦0.
                </Text>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.deliveryOption,
                  deliveryFee === effectiveFees.doorstep && styles.selectedOption,
                ]}
                onPress={() => setDeliveryFee(effectiveFees.doorstep)}
              >
                <Text style={styles.deliveryText}>Doorstep Delivery (₦{effectiveFees.doorstep.toLocaleString()})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deliveryOption,
                  deliveryFee === effectiveFees.pickup && styles.selectedOption,
                ]}
                onPress={() => setDeliveryFee(effectiveFees.pickup)}
              >
                <Text style={styles.deliveryText}>Pickup (₦{effectiveFees.pickup.toLocaleString()})</Text>
              </TouchableOpacity>
              {deliveryFee === null && (
                <Text style={styles.helperText}>Select a delivery option to proceed</Text>
              )}
            </>
          ) : null}

          <View style={styles.summaryRow}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalText}>₦{finalTotal.toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.secureNote}>Your payment is processed securely with Paystack</Text>

        <TouchableOpacity
          style={[
            styles.checkoutBtn,
            (!isFormValid || submitting) && { backgroundColor: "#ccc" },
          ]}
          disabled={!isFormValid || submitting}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutText}>Proceed to payment</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 10,
    color: "#333",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  // Input shared sizing
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: "#FB7C00",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  halfInput: {
    height: 56,
    borderWidth: 1,
    borderColor: "#FB7C00",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    flex: 1,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  lastInRow: { marginRight: 0 },

  // Picker wrapper to match input sizing
  pickerContainer: {
    height: 56,
    borderWidth: 1,
    borderColor: "#FB7C00",
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: "center",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  pickerStyle: {
    height: 56,
    width: "100%",
  },
  centerItems: { alignItems: "center", justifyContent: "center" },

  summaryBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryText: { fontSize: 16, fontWeight: "600", color: "#333" },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  itemInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  itemImage: { width: 40, height: 40, borderRadius: 6, marginRight: 8 },
  itemText: { fontSize: 15, color: "#444", flexShrink: 1 },

  deliveryOption: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  selectedOption: { backgroundColor: "#e0f7fa", borderColor: "#FB7C00" },
  deliveryText: { fontSize: 15, color: "#333" },

  totalText: { fontSize: 17, fontWeight: "bold", color: "#000" },
  secureNote: {
    fontSize: 14,
    color: "green",
    textAlign: "center",
    marginBottom: 12,
    fontStyle: "italic",
  },

  checkoutBtn: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  helperText: { color: "#666", fontSize: 12, marginTop: 4 },

  applyBtn: {
    backgroundColor: "#FB7C00",
    padding: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  applyText: { color: "#fff", fontWeight: "bold" },
  dropdownContainer: { position: "relative" },
  dropdownList: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 58,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    zIndex: 10,
  },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  dropdownText: { color: "#041330", fontSize: 14 },
});