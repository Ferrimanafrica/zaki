import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../context/CartContext";
import { router } from "expo-router";

export default function CartScreen() {
  const { cart, total, removeFromCart, clearCart } = useCart();
  const navigation = useNavigation<any>();

  const handleCheckout = () => {
    if (cart.length === 0) return;
    router.push("/Checkout" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Cart</Text>
        {cart.length > 0 && (
          <TouchableOpacity onPress={clearCart}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your cart is empty</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 10 }}
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <Image source={{ uri: item.image }} style={styles.itemImage} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    Qty: {item.quantity} • ₦{item.price.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemTotal}>
                    ₦{(item.price * item.quantity).toLocaleString()}
                  </Text>
                  <TouchableOpacity onPress={() => removeFromCart(item.id)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <View style={styles.footer}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkoutButton, cart.length === 0 && { opacity: 0.5 }]}
              disabled={cart.length === 0}
              onPress={handleCheckout}
            >
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#041330",
  },
  clearText: {
    fontSize: 14,
    color: "#FB7C00",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#667085",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: "#F2F4F7",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#041330",
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#667085",
  },
  itemRight: {
    alignItems: "flex-end",
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#041330",
  },
  removeText: {
    marginTop: 4,
    fontSize: 12,
    color: "#DC2626",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
  },
  totalLabel: {
    fontSize: 14,
    color: "#667085",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#041330",
  },
  checkoutButton: {
    backgroundColor: "#FB7C00",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  checkoutText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
