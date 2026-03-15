import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import debounce from 'lodash.debounce';
import { Dimensions, FlatList, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../context/CartContext';
import iphoneData from '../data/iphone_products.json';
import samsungData from '../data/samsung_products.json';
import redmiData from '../data/redmi_products.json';
import tecnoData from '../data/tecno_products.json';
import oraimoData from '../data/oraimo_products.json';

const { width } = Dimensions.get('window');
const BANNER_HEIGHT = 180;

const normalizeProduct = (item: any, idPrefix: string) => {
  if (!item) return null;
  let id, name, price, image;
  // Tecno/Oraimo style
  if (item.product_name) {
    name = item.product_name;
    const priceString = (item.price_ngn ?? item.price ?? '').toString().replace(/[^0-9.]/g, '');
    price = parseFloat(priceString);
    image = item.product_image ?? item.image_url ?? item.image ?? null;
    id = item.sku || `${idPrefix}-${name}`;
  } else if (typeof item.price_with_markup === 'number') {
    name = item.name ? item.name.split('\n')[0] : 'Unknown Product';
    price = item.price_with_markup;
    image = item.images && item.images.length > 0 ? item.images[0] : null;
    id = item.url || `${idPrefix}-${Math.random()}`;
  } else if ((item.price_naira || item.price) && item.image) {
    name = item.name || item.title || 'Unknown Product';
    const priceString = (item.price_naira ?? item.price).toString().replace(/[^0-9.]/g, '');
    price = parseFloat(priceString);
    image = item.image;
    id = `${idPrefix}-${name}`;
  } else if (item.images && (item.price_naira || item.price)) {
    name = item.name || item.title || 'Unknown Product';
    const priceString = (item.price_naira ?? item.price).toString().replace(/[^0-9.]/g, '');
    price = parseFloat(priceString);
    image = item.images[0] || null;
    id = `${idPrefix}-${name}`;
  }
  if (!id || !name || typeof price !== 'number' || isNaN(price)) return null;
  // Ensure ID is unique by appending a random string if it doesn't look like a SKU or URL
  if (!item.sku && !item.url) {
     id = `${id}-${Math.random().toString(36).substr(2, 9)}`;
  }
  return { id, name, price, image, quantity: 1 };
};

const PHONE_CATEGORIES = [
  { title: 'iPhones', data: (iphoneData?.products ?? []), id: 'iphone' },
  { title: 'Samsung Phones', data: (samsungData?.products ?? []), id: 'samsung' },
  { title: 'Redmi Phones', data: (redmiData?.products ?? []), id: 'redmi' },
  { title: 'Tecno Phones', data: (Array.isArray(tecnoData) ? tecnoData : []), id: 'tecno' },
  { title: 'Oraimo Products', data: (Array.isArray(oraimoData) ? oraimoData : []), id: 'oraimo' },
];

const bannerImages = [
  require('../assets/images/banner1.png'),
  require('../assets/images/banner2.png'),
  require('../assets/images/banner3.png'),
  require('../assets/images/banner4.png'),
];


export default function HomeScreen() {
  const { addToCart, itemCount } = useCart();
  const { width: winW } = useWindowDimensions();
  const bannerHeight = Math.max(160, Math.min(280, Math.round(winW * 0.45)));
  const cardWidth = Math.max(150, Math.min(220, Math.round(winW * 0.42)));
  const imageHeight = Math.max(100, Math.min(180, Math.round(cardWidth * 0.75)));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerRef = useRef<FlatList<any>>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  
  const [kitchenRemote, setKitchenRemote] = useState<any[]>([]);
  const [searchPrimary, setSearchPrimary] = useState<any | null>(null);
  const [searchSimilar, setSearchSimilar] = useState<any[]>([]);
  const searchDebounceRef = useRef<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchNotice, setShowSearchNotice] = useState(false);
  const noticeTimerRef = useRef<any>(null);

  useEffect(() => {
    try {
      if (Platform.OS === 'web') {
        (MaterialIcons as any)?.loadFont?.();
      }
    } catch {}
  }, []);


  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBanner((prev) => {
        const next = prev === bannerImages.length - 1 ? 0 : prev + 1;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);



  useEffect(() => {
    // Frontend scraping removed as per fundamental rules.
  }, []);

  const allDatasets: { data: any[]; id: string }[] = [
    { data: iphoneData?.products ?? [], id: 'iphone' },
    { data: samsungData?.products ?? [], id: 'samsung' },
    { data: redmiData?.products ?? [], id: 'redmi' },
    { data: Array.isArray(tecnoData) ? tecnoData : [], id: 'tecno' },
    { data: Array.isArray(oraimoData) ? oraimoData : [], id: 'oraimo' },
  ];

  const searchLocalDatasets = (q: string) => {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return [];
    const seen = new Set<string>();
    const results: any[] = [];
    for (const bucket of allDatasets) {
      const arr = Array.isArray(bucket.data) ? bucket.data : [];
      for (const raw of arr) {
        const product = normalizeProduct(raw, bucket.id);
        if (!product) continue;
        const key = product.id;
        const text = (product.name || '').toLowerCase();
        const desc = (raw?.description || raw?.desc || '').toLowerCase();
        if (!text && !desc) continue;
        if (text.includes(query) || desc.includes(query)) {
          if (key && !seen.has(key)) {
            seen.add(key);
            results.push(product);
          }
        }
      }
    }
    return results;
  };

  useEffect(() => {
    const oneDay = 24 * 60 * 60 * 1000;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          try { window.localStorage.removeItem('bannerClosed'); } catch {}
          const ts = window.localStorage.getItem('bannerClosedAt');
          const closedAt = ts ? Number(ts) : 0;
          const shouldHide = closedAt > 0 && (Date.now() - closedAt) < oneDay;
          setIsBannerVisible(!shouldHide);
        } else {
          try { await AsyncStorage.removeItem('bannerClosed'); } catch {}
          const ts = await AsyncStorage.getItem('bannerClosedAt');
          const closedAt = ts ? Number(ts) : 0;
          const shouldHide = closedAt > 0 && (Date.now() - closedAt) < oneDay;
          setIsBannerVisible(!shouldHide);
        }
      } catch {
        setIsBannerVisible(true);
      }
    })();
  }, []);

  const closeBanner = async () => {
    setIsBannerVisible(false);
    const now = String(Date.now());
    try {
      if (Platform.OS === 'web') {
        window.localStorage.setItem('bannerClosedAt', now);
      } else {
        await AsyncStorage.setItem('bannerClosedAt', now);
      }
    } catch {}
  };

  const performSearch = async (q: string) => {
    const query = q.trim().toLowerCase();
    if (!query) {
      setSearchPrimary(null);
      setSearchSimilar([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowSearchNotice(true);
    
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setShowSearchNotice(false), 3000);

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Local-only search
    const localImmediate = searchLocalDatasets(query);
    if (localImmediate.length > 0) {
      setSearchPrimary(localImmediate[0]);
      setSearchSimilar(localImmediate.slice(1));
      setShowSearchNotice(false);
      setIsSearching(false);
      return;
    }

    const msg = `${q} - currently out of stock`;
    setSearchPrimary({ id: `notfound-${Date.now()}`, name: msg, price: 0, image: null, quantity: 1 });
    setSearchSimilar([]);
    setShowSearchNotice(false);
    setIsSearching(false);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  };

  const debouncedSearch = useMemo(
    () =>
      debounce((q: string) => {
        performSearch(q);
      }, 1500),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    const q = String(text || '').trim().toLowerCase();
    if (q.length < 2) {
      setSearchPrimary(null);
      setSearchSimilar([]);
      setIsSearching(false);
      setShowSearchNotice(false);
      return;
    }
    debouncedSearch(q);
  }, []);

  const handleScroll = (event: any) => {
    const slide = Math.ceil(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    if (slide !== activeBanner) setActiveBanner(slide);
  };

  const renderBannerItem = ({ item }: { item: any }) => (
    <View style={[styles.bannerContainer, { width: winW, height: bannerHeight }]}>
      <Image source={item} style={[styles.bannerImage, { width: winW - 20, height: bannerHeight }]} resizeMode="cover" />
    </View>
  );

  const renderProductCard = (item: any, categoryId: string) => {
    if (!item) return null;
    const isNormalized = item && typeof item.price === 'number' && item.id && item.quantity !== undefined;
    const product = isNormalized ? item : normalizeProduct(item, categoryId);
    if (!product || !product.name || !product.price) return null;
    return (
      <TouchableOpacity
        key={product.id}
        style={[styles.productCard, { width: cardWidth }]}
        activeOpacity={0.8}
        onPress={() => {
          try {
            const payload = encodeURIComponent(JSON.stringify(product));
            router.push({ pathname: '/ProductDetail' as any, params: { product: payload } } as any);
          } catch {}
        }}
      >
        {product.image ? (
          <Image source={{ uri: product.image }} style={[styles.productImage, { height: imageHeight }]} resizeMode="contain" />
        ) : (
          <View style={[styles.productImage, { height: imageHeight, backgroundColor: '#eee' }]} />
        )}
        {['konga', 'jumia'].includes(product.source) && (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>From Zaki</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          <Text style={styles.productPrice}>₦{product.price.toLocaleString()}</Text>
          <TouchableOpacity style={styles.addToCartButton} onPress={() => addToCart(product)}>
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => {
                try {
                  router.push('/Cart' as any);
                } catch {}
              }}
            >
              <MaterialIcons name="shopping-cart" size={22} color="#041330" />
              {itemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => performSearch(searchQuery)}>
              <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
            </TouchableOpacity>
            <TextInput
              style={[styles.searchInput, (Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' } : {}) as any]}
              placeholder="What are you buying today?"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
        </View>

        {isBannerVisible && (
          <View style={[styles.bannerWrapper, { height: bannerHeight }]}>
            <FlatList
              ref={bannerRef}
              data={bannerImages}
              renderItem={renderBannerItem}
              horizontal
              pagingEnabled
              snapToInterval={winW}
              snapToAlignment="center"
              decelerationRate="fast"
              scrollEventThrottle={16}
              getItemLayout={(_, index) => ({ length: winW, offset: winW * index, index })}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              keyExtractor={(_, index) => index.toString()}
              style={[styles.bannerList, { height: bannerHeight }]}
            />
            <TouchableOpacity 
              style={styles.closeBannerButton} 
              onPress={closeBanner}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={24} color="rgba(0,0,0,0.5)" />
            </TouchableOpacity>
            <View style={styles.pagination}>
              {bannerImages.map((_, index) => (
                <View key={index} style={[styles.dot, activeBanner === index ? styles.activeDot : styles.inactiveDot]} />
              ))}
            </View>
          </View>
        )}



        {(isSearching || searchPrimary) && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <View style={styles.sectionLine} />
            </View>
            {showSearchNotice && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>Loading results...</Text>
              </View>
            )}
            {searchPrimary?.id?.startsWith('notfound-') ? (
              <View style={styles.outOfStockBox}>
                <Text style={styles.outOfStockText}>{searchPrimary.name}</Text>
              </View>
            ) : (
              (() => {
                const allResults = [searchPrimary, ...searchSimilar].filter(Boolean);
                const localResults = allResults.filter((p: any) => p.source !== 'konga');
                const kongaResults = allResults.filter((p: any) => p.source === 'konga');

                return (
                  <>
                    {localResults.length > 0 && (
                      <>
                        <View style={[styles.sectionHeader, { marginTop: 5, marginBottom: 5 }]}>
                          <Text style={[styles.sectionTitle, { fontSize: 14, color: '#555' }]}>From Zaki</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productList}>
                          {localResults.map((item: any) => renderProductCard(item, 'search-local'))}
                        </ScrollView>
                      </>
                    )}

                    {kongaResults.length > 0 && (
                      <>
                        <View style={[styles.sectionHeader, { marginTop: 15, marginBottom: 5 }]}>
                          <Text style={[styles.sectionTitle, { fontSize: 14, color: '#555' }]}>From Zaki</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productList}>
                          {kongaResults.map((item: any) => renderProductCard(item, 'search-konga'))}
                        </ScrollView>
                      </>
                    )}
                  </>
                );
              })()
            )}
          </View>
        )}

        {PHONE_CATEGORIES.map((category) => (
          <View key={category.id} style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{category.title}</Text>
              <View style={styles.sectionLine} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productList}>
              {category.data.slice(0, 4).map((item: any) => renderProductCard(item, category.id))}
            </ScrollView>
          </View>
        ))}

        <View style={styles.footerWrapper}>
          <View style={styles.footerStack}>
            <View style={styles.footerAccent} />
            <View style={styles.footerBase}>
              <View style={styles.footerCard}>
                <View style={styles.footerRow}>
                  <View style={styles.footerIconCircle}>
                    <MaterialIcons name="call" size={20} color="#fff" />
                  </View>
                  <Text style={styles.footerText}>
                    Customer Care Number:  +234 903 083 6252
                  </Text>
                </View>
                <View style={styles.footerDivider} />
                <View style={styles.footerRow}>
                  <View style={styles.footerIconCircle}>
                    <MaterialIcons name="mail" size={20} color="#fff" />
                  </View>
                  <Text style={styles.footerText}>
                    Email:  Hello@zaki.com
                  </Text>
                </View>
                <View style={styles.footerDivider} />
                <View style={styles.footerRow}>
                  <View style={styles.footerIconCircle}>
                    <MaterialIcons name="place" size={20} color="#fff" />
                  </View>
                  <Text style={styles.footerText}>
                    Air force base Mando, Kaduna
                  </Text>
                </View>
                <View style={styles.footerDotsRow}>
                  <View style={styles.footerDot} />
                  <View style={[styles.footerDot, { marginHorizontal: 6 }]} />
                  <View style={styles.footerDot} />
                </View>
                <Text style={styles.footerCopyright}>
                  © {new Date().getFullYear()} zaki. All rights reserved.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8D3BD' },
  scrollContent: { paddingBottom: 20 },
  searchContainer: { paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#E8D3BD' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 45,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  cartButton: {
    marginRight: 12,
    position: 'relative',
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FB7C00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  searchIcon: { marginRight: 10 },
  // Remove inner border/look on web and keep clean inside rounded container
  // RN-web still may show focus outline; handled inline via Platform check
  searchInput: { flex: 1, fontSize: 14, color: '#333', backgroundColor: 'transparent', borderWidth: 0 },
  bannerWrapper: {
    height: BANNER_HEIGHT,
    marginBottom: 20,
    position: 'relative',
  },
  closeBannerButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 15,
  },
  bannerList: {
    height: BANNER_HEIGHT,
  },
  bannerContainer: { width, height: BANNER_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  bannerImage: { width: width - 20, height: BANNER_HEIGHT, borderRadius: 15 },
  pagination: { position: 'absolute', bottom: 10, flexDirection: 'row', alignSelf: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 3 },
  activeDot: { backgroundColor: '#F78B1F' },
  inactiveDot: { backgroundColor: 'rgba(255, 255, 255, 0.5)' },

  sectionContainer: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#F78B1F', marginRight: 10 },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#F78B1F', opacity: 0.5 },
  productList: { flexDirection: 'row', paddingHorizontal: 15 },
  categoryPager: { paddingBottom: 10 },
  categoryPage: { width },
  productCard: {
    width: 160,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 15,
    marginRight: 15,
    padding: 10,
    ...Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  productImage: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },
  productInfo: { flex: 1, justifyContent: 'space-between' },
  productName: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 5, height: 36 },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#F78B1F', marginBottom: 10 },
  addToCartButton: { backgroundColor: '#F78B1F', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  addToCartText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  verticalProductList: { paddingHorizontal: 15 },
  footerWrapper: { paddingHorizontal: 15, marginTop: 10 },
  footerStack: { position: 'relative' },
  footerAccent: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 18,
    backgroundColor: '#F78B1F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    opacity: 0.9,
  },
  footerBase: {
    backgroundColor: '#EEDFCC',
    borderRadius: 26,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { boxShadow: '0px 6px 10px rgba(0,0,0,0.08)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 5,
      },
    }),
  },
  footerCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    ...Platform.select({
      web: { boxShadow: '0px 3px 6px rgba(0,0,0,0.06)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  footerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F78B1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  footerText: { fontSize: 16, color: '#231F20' },
  footerDivider: { height: 1, backgroundColor: '#F78B1F', opacity: 0.2 },
  footerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  footerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F7A95A' },
  footerCopyright: { textAlign: 'center', color: '#231F20', fontSize: 14, paddingTop: 4 },
  noticeBox: {
    marginHorizontal: 15,
    marginBottom: 10,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    ...Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  noticeText: { fontSize: 14, color: '#231F20' },
  outOfStockBox: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFF',
    borderRadius: 12,
    ...Platform.select({
      web: { boxShadow: '0px 2px 3px rgba(0,0,0,0.05)' } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  outOfStockText: { fontSize: 15, color: '#231F20' },
  sourceBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#ED017F', // Konga pink
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  sourceText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
