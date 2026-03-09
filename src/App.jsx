import { useState, useMemo, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Search, Menu, MapPin, Clock, Thermometer, Leaf, Pencil, Star, X, Info, Tag } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

// Sub-categories that roll up into a parent top-level category.
// Any category NOT listed here is treated as its own top-level.
const SUB_TO_PARENT = {
  Ceylon: 'Black',
  Sencha: 'Green',
  Jasmine: 'Green',
};

const getParentCategory = (cat) => SUB_TO_PARENT[cat] || cat;

const isSubCategory = (cat) => cat in SUB_TO_PARENT;

const getCategoryColorClass = (catName) => {
  if (!catName) return '';
  const name = catName.toLowerCase();
  if (name.includes('favorites')) return 'cat-color-favorites';
  if (name.includes('rooibos')) return 'cat-color-rooibos';
  if (name.includes('black')) return 'cat-color-black';
  if (name.includes('green') || name.includes('sencha') || name.includes('jasmine') || name.includes('matcha')) return 'cat-color-green';
  if (name.includes('oolong')) return 'cat-color-oolong';
  if (name.includes('white')) return 'cat-color-white';
  if (name.includes('herbal') || name.includes('chamomile')) return 'cat-color-herbal';
  if (name.includes('blend')) return 'cat-color-blend';
  return '';
};

const getGradientClass = (category) => {
  if (category === "All" || category === "Favorites") return 'grad-default';
  const c = getParentCategory(category).toLowerCase();
  if (c.includes('green')) return 'grad-green';
  if (c.includes('black') || c.includes('blend')) return 'grad-black';
  if (c.includes('oolong')) return 'grad-oolong';
  if (c.includes('white')) return 'grad-white';
  if (c.includes('herbal')) return 'grad-herbal';
  return 'grad-default';
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.015 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 28 } }
};
import teasData from './data/teas.json';
import './admin.css';
import TeaAdmin from './TeaAdmin';

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [caffeineFilter, setCaffeineFilter] = useState("All");
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchForced, setIsSearchForced] = useState(false);
  const [selectedTea, setSelectedTea] = useState(null);
  const lenisRef = useRef(null);
  const searchInputRef = useRef(null);

  // Initialize Lenis smooth scroll and wire scroll state to it
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    lenis.on('scroll', ({ scroll, velocity }) => {
      setIsScrolled(scroll > 50);
      if (Math.abs(velocity) > 0.8) {
        setIsSearchForced(false);
      }
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  // Lock body scroll when overlay is active
  useEffect(() => {
    if (selectedTea || isAdminOpen) {
      document.body.classList.add('lock-scroll');
      if (lenisRef.current) lenisRef.current.stop();
    } else {
      document.body.classList.remove('lock-scroll');
      if (lenisRef.current) lenisRef.current.start();
    }
    return () => {
      document.body.classList.remove('lock-scroll');
      if (lenisRef.current) lenisRef.current.start();
    };
  }, [selectedTea, isAdminOpen]);

  const allCategories = useMemo(() => {
    const cats = new Set();
    teasData.forEach(t => {
      if (Array.isArray(t.categories)) {
        t.categories.forEach(c => cats.add(c));
      } else if (t.category) {
        cats.add(t.category);
      }
    });

    // Build top-level categories only (filter out sub-categories and Add-Ons from main list)
    const topLevel = new Set();
    cats.forEach(c => {
      if (c === 'Add-Ons') return; // handled separately
      topLevel.add(getParentCategory(c));
    });
    return ["All", "Favorites", ...Array.from(topLevel).sort()];
  }, []);

  // Filter and group teas
  const groupedTeas = useMemo(() => {
    let filtered = teasData;

    // Add-Ons should ONLY appear when Add-Ons is the active category
    if (activeCategory !== "Add-Ons") {
      filtered = filtered.filter(tea => {
        const cats = tea.categories || (tea.category ? [tea.category] : []);
        return !cats.includes("Add-Ons");
      });
    }

    if (activeCategory === "Favorites") {
      filtered = filtered.filter(tea => tea.favoriteS || tea.favoriteK);
    } else if (activeCategory === "Add-Ons") {
      filtered = filtered.filter(tea => {
        const cats = tea.categories || (tea.category ? [tea.category] : []);
        return cats.includes("Add-Ons");
      });
    } else if (activeCategory !== "All") {
      filtered = filtered.filter(tea => {
        const cats = tea.categories || (tea.category ? [tea.category] : []);
        return cats.some(c => getParentCategory(c) === activeCategory);
      });
    }

    if (caffeineFilter !== "All") {
      filtered = filtered.filter(tea => {
        const isCaf = tea.caffeinated === "Yes";
        if (caffeineFilter === "Caffeinated") return isCaf;
        if (caffeineFilter === "Caffeine-Free") return !isCaf;
        return true;
      });
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((tea) => {
        const cats = tea.categories || (tea.category ? [tea.category] : []);
        const catsMatch = cats.join(' ').toLowerCase().includes(q);
        const ObjectValuesMatch = Object.values(tea).some(val =>
          String(val).toLowerCase().includes(q)
        );
        return ObjectValuesMatch || catsMatch;
      });
    }

    // Sort globally: Alphabetically by name everywhere
    const sortedFiltered = [...filtered].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    const groups = {};
    if (activeCategory === "All" || activeCategory === "Favorites" || activeCategory === "Add-Ons") {
      const label = activeCategory === "All" ? "All Teas" : activeCategory;
      groups[label] = sortedFiltered;
    } else {
      sortedFiltered.forEach(tea => {
        const cats = (tea.categories && tea.categories.length > 0) ? tea.categories : ["Misc"];
        cats.forEach(cat => {
          const mapped = getParentCategory(cat);
          if (mapped !== activeCategory) return;
          if (!groups[mapped]) groups[mapped] = [];
          if (!groups[mapped].includes(tea)) groups[mapped].push(tea);
        });
      });
    }

    return groups;
  }, [searchQuery, activeCategory, caffeineFilter]);

  // Sort groups alphabetically
  const displayedCategories = Object.keys(groupedTeas).sort();

  const renderNav = (isForced) => (
    <div className="floating-nav">
      <div className="nav-content">
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input
            ref={isForced ? searchInputRef : null}
            type="text"
            className="search-input"
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-controls-row">
          <div className="caffeine-segmented-control">
            {['All', 'Caffeinated', 'Caffeine-Free'].map(option => (
              <button
                key={option}
                className={`segment-btn ${caffeineFilter === option ? 'active' : ''}`}
                onClick={() => {
                  setCaffeineFilter(option);
                  lenisRef.current?.scrollTo(0, { immediate: false, duration: 1.2 });
                }}
              >
                {caffeineFilter === option && (
                  <motion.div
                    layoutId={`caffeine-active-${isForced}`}
                    className="segment-active-bg"
                    initial={false}
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="segment-label">{option}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="category-scroll">
          {allCategories.filter(cat => cat !== 'Add-Ons').map(cat => (
            <button
              key={cat}
              className={`category-pill ${activeCategory === cat ? 'active' : ''} ${activeCategory !== cat ? getCategoryColorClass(cat) : ''}`}
              onClick={() => {
                setActiveCategory(cat);
                lenisRef.current?.scrollTo(0, { immediate: false, duration: 1.2 });
              }}
            >
              {cat}
            </button>
          ))}
          <div className="category-divider"></div>
          <button
            key="Add-Ons"
            className={`category-pill addon-pill ${activeCategory === 'Add-Ons' ? 'active' : ''} ${activeCategory !== 'Add-Ons' ? getCategoryColorClass('Add-Ons') : ''}`}
            onClick={() => {
              setActiveCategory('Add-Ons');
              lenisRef.current?.scrollTo(0, { immediate: false, duration: 1.2 });
            }}
          >
            Add-Ons
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-wrapper">
      <AnimatePresence>
        <motion.div
          key={activeCategory}
          className={`bg-gradient ${getGradientClass(activeCategory)}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      </AnimatePresence>

      <div className="hero-header">
        <h1 className="page-title">Tea Collection</h1>
        <p className="page-subtitle">Our personal collection of fine teas, curated to share with family and guests.</p>
      </div>

      <div className="floating-nav-container" style={{ opacity: isSearchForced ? 0 : 1, pointerEvents: isSearchForced ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
        {renderNav(false)}
      </div>

      <AnimatePresence>
        {isSearchForced && (
          <motion.div
            className="fixed-search-overlay"
            initial={{ y: -120 }}
            animate={{ y: 0 }}
            exit={{ y: -120 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          >
            {renderNav(true)}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="content">
        <AnimatePresence mode="popLayout">
          {displayedCategories.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="empty-state"
            >
              <div className="empty-icon-wrapper">
                <Leaf size={40} className="empty-icon" />
              </div>
              <h3>No results found</h3>
              <p>Try tweaking your search or category.</p>
            </motion.div>
          ) : (
            displayedCategories.map((category) => (
              <motion.section
                key={category}
                className="list-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                {(() => {
                  const isFlatList = activeCategory === 'All' || activeCategory === 'Favorites' || activeCategory === 'Add-Ons';
                  return (
                    <h2 className="section-title sticky-title" style={{ opacity: isFlatList ? 0 : 1, height: isFlatList ? '0' : 'auto', margin: isFlatList ? '0' : undefined, padding: isFlatList ? '0' : undefined }}>{category}</h2>
                  );
                })()}
                <motion.div
                  className="list-card"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {groupedTeas[category].map((tea, index) => {
                    const isAddOn = (tea.categories || []).includes('Add-Ons');
                    return (
                      <motion.div
                        key={tea.id}
                        className={`list-row ${!tea.inStock ? 'out-of-stock' : ''}`}
                        variants={itemVariants}
                        layout="position"
                      >
                        <div className="row-content" onClick={() => setSelectedTea(tea)} style={{ cursor: 'pointer' }}>
                          <div className="row-header">
                            <div className="title-group">
                              {tea.favoriteS && (
                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Star className="favorite-icon" size={18} fill="#FF9500" color="#FF9500" />
                                  <span style={{ position: 'absolute', fontSize: '9px', color: '#fff', fontWeight: 'bold', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '1px' }}>S</span>
                                </div>
                              )}
                              {tea.favoriteK && (
                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Star className="favorite-icon" size={18} fill="#34C759" color="#34C759" />
                                  <span style={{ position: 'absolute', fontSize: '9px', color: '#fff', fontWeight: 'bold', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '1px' }}>K</span>
                                </div>
                              )}
                              <span className="tea-name">{tea.name}</span>
                            </div>
                            {!tea.inStock && <span className="badge">Out of Stock</span>}
                          </div>

                          <p className="tea-desc">{tea.flavourNotes}</p>

                          <div className="tea-meta">
                            {(() => {
                              const showAllTags = activeCategory === "All" || activeCategory === "Favorites";
                              const hasSubCat = tea.categories?.some(c => isSubCategory(c));
                              if (showAllTags || hasSubCat) {
                                return tea.categories?.map((c, i) => (
                                  <div key={i} className={`meta-pill category-meta ${getCategoryColorClass(c)}`}>
                                    <Tag size={12} /> <span>{c}</span>
                                  </div>
                                ));
                              }
                              return null;
                            })()}
                            {tea.origin && tea.origin !== "Unknown" && (
                              <div className="meta-pill">
                                <MapPin size={14} /> <span>{tea.origin}</span>
                              </div>
                            )}
                            {!isAddOn && tea.temperature && (
                              <div className="meta-pill">
                                <Thermometer size={14} /> <span>{tea.temperature}</span>
                              </div>
                            )}
                            {!isAddOn && tea.brewTime && (
                              <div className="meta-pill">
                                <Clock size={14} /> <span>{tea.brewTime}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {index !== groupedTeas[category].length - 1 && <div className="hairline"></div>}
                      </motion.div>
                    )
                  })}
                </motion.div>
              </motion.section>
            ))
          )}
        </AnimatePresence>
      </main>


      <div
        className={`floating-search-bubble ${isScrolled ? 'visible' : ''}`}
        onClick={() => {
          if (isSearchForced) {
            setIsSearchForced(false);
          } else {
            setIsSearchForced(true);
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }
        }}
        style={{ zIndex: 1005 }}
      >
        {isSearchForced ? (
          <X size={22} color="var(--danger-color)" />
        ) : (
          <Menu size={22} color="var(--text-secondary)" />
        )}
      </div>

      <AnimatePresence>
        {selectedTea && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTea(null)}
          >
            <motion.div
              className="modal-content"
              data-lenis-prevent
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="modal-close" onClick={() => setSelectedTea(null)}>
                <X size={24} />
              </button>

              <div className="modal-header">
                <h2 style={{ marginBottom: '12px' }}>{selectedTea.name}</h2>
                <div className="modal-tags">
                  {selectedTea.categories?.map(c => <span key={c} className={`modal-tag ${getCategoryColorClass(c)}`}>{c}</span>)}
                  {selectedTea.favoriteS && (
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Star className="favorite-icon" size={20} fill="#FF9500" color="#FF9500" />
                      <span style={{ position: 'absolute', fontSize: '9px', color: '#fff', fontWeight: 'bold', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '1px' }}>S</span>
                    </div>
                  )}
                  {selectedTea.favoriteK && (
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Star className="favorite-icon" size={20} fill="#34C759" color="#34C759" />
                      <span style={{ position: 'absolute', fontSize: '9px', color: '#fff', fontWeight: 'bold', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '1px' }}>K</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-body">
                <p className="modal-desc">{selectedTea.description}</p>

                <div className="detail-grid">
                  {selectedTea.temperature && (
                    <div className="detail-item">
                      <Thermometer size={18} className="detail-icon" />
                      <div className="detail-text">
                        <span className="detail-label">Temperature</span>
                        <span className="detail-value">{selectedTea.temperature}</span>
                      </div>
                    </div>
                  )}
                  {selectedTea.brewTime && (
                    <div className="detail-item">
                      <Clock size={18} className="detail-icon" />
                      <div className="detail-text">
                        <span className="detail-label">Steep Time</span>
                        <span className="detail-value">{selectedTea.brewTime}</span>
                      </div>
                    </div>
                  )}
                  <div className="detail-item">
                    <MapPin size={18} className="detail-icon" />
                    <div className="detail-text">
                      <span className="detail-label">Origin</span>
                      <span className="detail-value">{selectedTea.origin || "Unknown"}</span>
                    </div>
                  </div>
                  <div className="detail-item">
                    <Info size={18} className="detail-icon" />
                    <div className="detail-text">
                      <span className="detail-label">Caffeine</span>
                      <span className="detail-value">{selectedTea.caffeinated || "Unknown"}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Flavour Notes</h3>
                  <p>{selectedTea.flavourNotes}</p>
                </div>

                {selectedTea.tips && (
                  <div className="detail-section">
                    <h3>Pro Tips</h3>
                    <p>{selectedTea.tips}</p>
                  </div>
                )}

                {selectedTea.brand && (
                  <div className="detail-section">
                    <h3>Brand</h3>
                    <p>{selectedTea.brand}</p>
                  </div>
                )}

                {selectedTea.location && (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', marginTop: '8px' }}>
                    Location: {selectedTea.location}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {isAdminOpen && <TeaAdmin teas={teasData} onClose={() => setIsAdminOpen(false)} />}

      {import.meta.env.DEV && !isAdminOpen && (
        <button className="floating-edit-btn" onClick={() => setIsAdminOpen(true)}>
          <Pencil size={24} />
        </button>
      )}
    </div>
  );
}

export default App;
