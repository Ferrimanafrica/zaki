// screens/ProductDetailScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "../context/CartContext";
import { useLocalSearchParams, router } from "expo-router";
import { useRoute } from "@react-navigation/native";
import Constants from "expo-constants";
import { API } from "../lib/api";

const { width } = Dimensions.get("window");



// ✅ Extract all possible product images into a uniform array
const extractProductImages = (p: any) => {
  let imgs: string[] = [];

  if (Array.isArray(p.images)) {
    imgs = p.images.map((i: any) => (typeof i === "string" ? i : i.url)).filter(Boolean);
  } else if (Array.isArray(p.gallery)) {
    imgs = p.gallery.map((i: any) => (typeof i === "string" ? i : i.url)).filter(Boolean);
  }

  if (p.image_url) imgs.push(p.image_url);
  if (p.image) imgs.push(p.image);
  if (p.thumbnail) imgs.push(p.thumbnail);
  if (p.imageUrl) imgs.push(p.imageUrl);
  if (p.product_image) imgs.push(p.product_image);

  // Remove duplicates
  return [...new Set(imgs.filter(Boolean))];
};

// ✅ Helper to format price neatly
const formatPrice = (price: number) =>
  price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const rnRoute = useRoute<any>();
  let product: any = (rnRoute as any)?.params?.product ?? (params as any)?.product;
  if (typeof product === "string") {
    try {
      const decoded = decodeURIComponent(product);
      product = JSON.parse(decoded);
    } catch {
      // fallback: leave as string
    }
  }
  const { addToCart, cart } = useCart();

  const [successMessage, setSuccessMessage] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;


  const name = (product.product_name || product.name || "Unnamed")
    .replace(/\nYou'll earn NGN.*on this/, "")
    .trim()
    .replace(/konga|jumia/gi, "zaki")
    .replace(/jumia\.com(\.ng)?/gi, "zaki.com");

  let rawPrice = product.price_with_markup ?? product.price ?? "0";
  const numericPrice = Number(rawPrice.toString().replace(/[^0-9.-]+/g, "")) || 0;

  const initialDesc = (product.description || "Exceptional product with high quality.")
    .replace(/konga|jumia/gi, "zaki")
    .replace(/jumia\.com(\.ng)?/gi, "Zaki.com");
  const [descriptionText, setDescriptionText] = useState<string>(initialDesc);
  const [aiLoading, setAiLoading] = useState<boolean>(true);
  const totalItems = cart.length;
  const images = extractProductImages(product);
  const [galleryImages, setGalleryImages] = useState<string[]>(images);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // 🔹 Animation: smooth zoom pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

 

  useEffect(() => {
    let active = true;
    const gen = async () => {
      setAiLoading(true);
      await new Promise((r) => setTimeout(r, 0));
      const baseName = name.toLowerCase();
      let kind = "";
      if (baseName.includes("cream") || baseName.includes("lotion")) kind = "skincare product";
      else if (baseName.includes("toothpaste") || baseName.includes("brush")) kind = "oral care product";
      else if (baseName.includes("rice") || baseName.includes("macaroni")) kind = "food item";
      else if (baseName.includes("camera") || baseName.includes("vlog")) kind = "camera accessory";
      else if (baseName.includes("book")) kind = "book";
      else if (baseName.includes("deodorant") || baseName.includes("spray")) kind = "personal care product";
      else if (baseName.includes("shoe") || baseName.includes("crocs")) kind = "footwear";
      else kind = "quality product";
      const s = selectedSize ? ` size ${selectedSize}` : "";
      const c = selectedColor ? ` in ${selectedColor}` : "";
      const desc = `${name}${s}${c} is a ${kind} designed for everyday use. It helps with day-to-day needs and is suitable for its intended purpose.`;
      if (active) {
        setDescriptionText(desc);
        setAiLoading(false);
      }
    };
    gen();
    return () => {
      active = false;
    };
  }, [name, selectedSize, selectedColor]);
  useEffect(() => {
    const isKonga = String(product?.source || "").toLowerCase() === "konga";
    const productUrl = product?.productUrl;
    if (!isKonga || !productUrl) return;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    (async () => {
      try {
        const data = await API.getProductDetails(productUrl);
        clearTimeout(t);
        const d = String(data?.description || "").trim();
        const gal = Array.isArray(data?.gallery) ? data.gallery : [];
        const opts = data?.options || {};
        if (d) setDescriptionText(d.replace(/konga|jumia/gi, "ferrimani").replace(/jumia\.com(\.ng)?/gi, "ferrimani.com"));
        if (gal.length > 0) {
          const merged = Array.from(new Set([...gal, ...galleryImages])).filter(Boolean);
          setGalleryImages(merged);
        }
        const sizes = Array.isArray(opts?.sizes) ? opts.sizes.filter(Boolean) : [];
        const colors = Array.isArray(opts?.colors) ? opts.colors.filter(Boolean) : [];
        setAvailableSizes(sizes);
        setAvailableColors(colors);
        if (sizes.length > 0 && !selectedSize) setSelectedSize(sizes[0]);
        if (colors.length > 0 && !selectedColor) setSelectedColor(colors[0]);
      } catch {
        clearTimeout(t);
      }
    })();
    return () => {
      try { clearTimeout(t); } catch {}
      try { controller.abort(); } catch {}
    };
  }, [product?.productUrl, product?.source]);


  // 🔹 Add to Cart
  const handleAddToCart = () => {
    addToCart({ id: name, name, price: numericPrice, image: images[0] });
    setSuccessMessage("Successfully added to cart");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  // 🔹 Buy Now
  const handleBuyNow = () => {
    addToCart({ id: name, name, price: numericPrice, image: images[0] });
    router.push("/Checkout" as any);
  };

  // 🔹 Render a single image
  const renderImage = ({ item }: { item: string }) => (
    <Animated.Image
      source={{ uri: item }}
      style={[styles.image, { transform: [{ scale: scaleAnim }] }]}
      resizeMode="contain"
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartIcon}
            onPress={() => router.push("/Cart" as any)}
          >
            <Text style={{ fontSize: 22 }}>🛒</Text>
            {totalItems > 0 && (
              <View style={styles.badge}>
                <Text style={{ color: "white", fontSize: 10 }}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {galleryImages.length > 0 ? (
          <View>
            <FlatList
              data={galleryImages}
              keyExtractor={(item, index) => index.toString()}
              renderItem={renderImage}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentIndex(index);
              }}
            />

            <View style={styles.pagination}>
              {galleryImages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentIndex === index && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={{ color: "#888" }}>No Image Available</Text>
          </View>
        )}

        <Text style={styles.name}>{name}</Text>
        <Text style={styles.price}>₦{formatPrice(numericPrice)}</Text>

        {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}



        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={handleAddToCart}>
            <Text style={styles.buttonText}>Add to Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.buyNowButton} onPress={handleBuyNow}>
            <Text style={styles.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>

        {availableColors.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 6 }}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableColors.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setSelectedColor(c)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selectedColor === c ? "#FB7C00" : "#ccc",
                    backgroundColor: selectedColor === c ? "#FFF3E7" : "#fff",
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "#041330" }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {availableSizes.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 6 }}>Size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableSizes.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSelectedSize(s)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selectedSize === s ? "#FB7C00" : "#ccc",
                    backgroundColor: selectedSize === s ? "#FFF3E7" : "#fff",
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: "#041330" }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {aiLoading ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator size="small" />
          </View>
        ) : (
          <Text style={styles.description}>{descriptionText}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cartIcon: { position: "relative" },
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    backgroundColor: "red",
    borderRadius: 10,
    paddingHorizontal: 5,
  },

  image: {
    width: width,
    height: 300,
  },
  imagePlaceholder: {
    width: "100%",
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },

  pagination: {
    flexDirection: "row",
    alignSelf: "center",
    marginVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: "#FB7C00",
    width: 10,
    height: 10,
  },

  name: { fontSize: 22, fontWeight: "bold", marginVertical: 6 },
  price: { fontSize: 20, color: "#FB7C00", marginBottom: 12 },
  success: { color: "green", fontSize: 14, marginBottom: 12, fontWeight: "500" },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  button: {
    flex: 1,
    backgroundColor: "#FB7C00",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginRight: 5,
  },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  buyNowButton: {
    flex: 1,
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginLeft: 5,
  },
  buyNowText: { color: "white", fontSize: 16, fontWeight: "bold" },
  description: { fontSize: 16, color: "#333", marginBottom: 20 },

});