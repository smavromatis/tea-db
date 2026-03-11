import { useState, useMemo } from 'react';
import { X, Plus, Save, Trash2, ChevronDown, ChevronUp, Star, Check, PlusCircle, Search, Copy } from 'lucide-react';

// Category structure: parent → known sub-categories (presets)
// Users may also create new sub-categories via the admin
const CATEGORY_STRUCTURE = {
    Black: ['Ceylon'],
    Green: ['Sencha', 'Jasmine'],
    Herbal: [],
    Oolong: [],
    Rooibos: [],
    'Add-Ons': [],
};

// Derive which sub-categories map to which parent
const SUB_TO_PARENT = {};
Object.entries(CATEGORY_STRUCTURE).forEach(([parent, subs]) => {
    subs.forEach(sub => { SUB_TO_PARENT[sub] = parent; });
});

const getParentCategory = (cat) => SUB_TO_PARENT[cat] || cat;

// Build a full list of all known categories (parents + subs)
const ALL_KNOWN_CATEGORIES = new Set();
Object.entries(CATEGORY_STRUCTURE).forEach(([parent, subs]) => {
    ALL_KNOWN_CATEGORIES.add(parent);
    subs.forEach(s => ALL_KNOWN_CATEGORIES.add(s));
});

export default function TeaAdmin({ teas: initialTeas, onClose }) {
    const [teas, setTeas] = useState([...initialTeas]);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [newCatInputs, setNewCatInputs] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");

    const allNavCategories = useMemo(() => {
        const topLevel = new Set();
        teas.forEach(t => {
            const cats = Array.isArray(t.categories) ? t.categories : (t.category ? [t.category] : []);
            cats.forEach(c => {
                if (c === 'Add-Ons') return;
                topLevel.add(getParentCategory(c));
            });
        });
        return ["All", "Favorites", ...Array.from(topLevel).sort()];
    }, [teas]);

    const existingCategories = useMemo(() => {
        const cats = new Set();
        teas.forEach(t => {
            if (Array.isArray(t.categories)) t.categories.forEach(c => cats.add(c));
            else if (t.category) cats.add(t.category);
        });
        return Array.from(cats).filter(Boolean).sort();
    }, [teas]);

    const existingOrigins = useMemo(() => Array.from(new Set(teas.map(t => t.origin))).filter(Boolean).sort(), [teas]);
    const existingBrewTimes = useMemo(() => Array.from(new Set(teas.map(t => t.brewTime))).filter(Boolean).sort(), [teas]);
    const existingTemperatures = useMemo(() => Array.from(new Set(teas.map(t => t.temperature))).filter(Boolean).sort(), [teas]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/tea-db/api/teas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(teas, null, 2)
            });
            if (!response.ok) throw new Error("Failed to save");
            alert("Successfully saved! Changes apply immediately.");
            onClose();
            window.location.reload();
        } catch (e) {
            alert("Error saving: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const updateTea = (id, field, value) => {
        setTeas(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const updateScale = (id, scaleField, value) => {
        setTeas(prev => prev.map(t => {
            if (t.id !== id) return t;
            const newScales = { ...(t.scales || { intensity: 50, mouthfeel: 50, flavor: 50, sweetness: 50 }), [scaleField]: parseInt(value, 10) };
            return { ...t, scales: newScales };
        }));
    };

    const toggleTeaCategory = (id, category) => {
        setTeas(prev => prev.map(t => {
            if (t.id !== id) return t;
            let cats = Array.isArray(t.categories) ? [...t.categories] : [];
            if (cats.includes(category)) {
                cats = cats.filter(c => c !== category);
            } else {
                cats.push(category);
            }
            return { ...t, categories: cats };
        }));
    };

    const addNewCategory = (id) => {
        const val = newCatInputs[id]?.trim();
        if (!val) return;

        setTeas(prev => prev.map(t => {
            if (t.id !== id) return t;
            let cats = Array.isArray(t.categories) ? [...t.categories] : [];
            if (!cats.includes(val)) {
                cats.push(val);
            }
            return { ...t, categories: cats };
        }));
        setNewCatInputs(prev => ({ ...prev, [id]: '' }));
    };

    const removeTea = (id) => {
        if (confirm("Are you sure you want to delete this tea?")) {
            setTeas(prev => prev.filter(t => t.id !== id));
        }
    };

    const duplicateTea = (id) => {
        const teaToCopy = teas.find(t => t.id === id);
        if (!teaToCopy) return;

        const newId = String(Date.now());
        const newTea = {
            ...teaToCopy,
            id: newId,
            name: teaToCopy.name + " (Copy)"
        };

        setTeas([newTea, ...teas]);
        setExpandedId(newId);
        setSearchQuery(""); // clear search to ensure it is visible
    };

    const addTea = () => {
        const newId = String(Date.now());
        const isFav = activeCategory === "Favorites";
        const isValidCat = activeCategory !== "All" && activeCategory !== "Favorites";
        const newTeas = [{
            id: newId,
            name: "", // Empty name sorts to the very top alphabetically
            categories: isValidCat ? [activeCategory] : [],
            origin: "",
            brewTime: "",
            temperature: "",
            description: "",
            aiSemanticProfile: "",
            scales: { intensity: 50, mouthfeel: 50, flavor: 50, sweetness: 50 },
            inStock: true,
            favoriteS: isFav ? true : false,
            favoriteK: false
        }, ...teas];
        setTeas(newTeas);
        setExpandedId(newId);
        setSearchQuery(""); // clear search to ensure they see the new tea

        // Scroll to the top automatically to make it incredibly obvious
        setTimeout(() => {
            const adminOverlay = document.querySelector('.admin-content');
            if (adminOverlay) adminOverlay.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
    };

    const filteredTeas = useMemo(() => {
        let result = teas;

        // Add-Ons should ONLY appear when Add-Ons is the active category
        if (activeCategory !== "Add-Ons") {
            result = result.filter(tea => {
                const cats = Array.isArray(tea.categories) ? tea.categories : (tea.category ? [tea.category] : []);
                return !cats.includes("Add-Ons");
            });
        }

        if (activeCategory === "Favorites") {
            result = result.filter(tea => tea.favoriteS || tea.favoriteK);
        } else if (activeCategory === "Add-Ons") {
            result = result.filter(tea => {
                const cats = Array.isArray(tea.categories) ? tea.categories : (tea.category ? [tea.category] : []);
                return cats.includes("Add-Ons");
            });
        } else if (activeCategory !== "All") {
            result = result.filter(tea => {
                const cats = Array.isArray(tea.categories) ? tea.categories : (tea.category ? [tea.category] : []);
                return cats.some(c => getParentCategory(c) === activeCategory);
            });
        }

        if (!searchQuery.trim()) {
            return [...result].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }

        const q = searchQuery.toLowerCase();
        return result.filter(tea => {
            const catsMatch = Array.isArray(tea.categories) ? tea.categories.join(' ').toLowerCase().includes(q) : false;
            return tea.name?.toLowerCase().includes(q) ||
                tea.description?.toLowerCase().includes(q) ||
                catsMatch;
        }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }, [teas, searchQuery, activeCategory]);

    return (
        <div className="admin-overlay" data-lenis-prevent="true">
            <div className="admin-header blur-header">
                <h2>Manage Catalog</h2>
                <div className="admin-actions">
                    <button className="admin-btn cancel" onClick={onClose}><X size={18} /> Close</button>
                    <button className="admin-btn save" onClick={handleSave} disabled={isSaving}>
                        <Save size={18} /> {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            <div className="admin-content" style={{ paddingTop: '20px' }}>
                <div className="admin-controls-container">
                    <div className="category-scroll" style={{ padding: '0 0 12px 0' }}>
                        {allNavCategories.map(cat => (
                            <button
                                key={cat}
                                className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                        <div className="category-divider"></div>
                        <button
                            key="Add-Ons"
                            className={`category-pill addon-pill ${activeCategory === 'Add-Ons' ? 'active' : ''}`}
                            onClick={() => setActiveCategory('Add-Ons')}
                        >
                            Add-Ons
                        </button>
                    </div>

                    <div className="admin-search">
                        <Search className="search-icon" size={18} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button className="admin-btn add-btn" style={{ marginBottom: 0 }} onClick={addTea}>
                        <Plus size={18} /> Add Tea
                    </button>
                </div>

                {/* Datalists for our inputs to provide Native Dropdowns without locking the input */}
                <datalist id="origins-list">
                    {existingOrigins.map(o => <option key={o} value={o} />)}
                </datalist>
                <datalist id="brews-list">
                    {existingBrewTimes.map(b => <option key={b} value={b} />)}
                </datalist>
                <datalist id="temps-list">
                    {existingTemperatures.map(t => <option key={t} value={t} />)}
                </datalist>

                <div className="admin-list" style={{ marginTop: '20px' }}>
                    {filteredTeas.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            No teas matched your search.
                        </div>
                    )}

                    {filteredTeas.map((tea) => {
                        const isExpanded = expandedId === tea.id;
                        const teaCats = Array.isArray(tea.categories) ? tea.categories : [];

                        return (
                            <div key={tea.id} className={`admin-card ${(tea.favoriteS || tea.favoriteK) ? 'is-favorite' : ''} ${isExpanded ? 'expanded' : ''}`}>

                                <div className="admin-compact-row" onClick={() => setExpandedId(isExpanded ? null : tea.id)}>
                                    <div className="compact-info">
                                        <h4 style={{ display: 'flex', alignItems: 'center' }}>
                                            {tea.favoriteS && (
                                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '6px' }}>
                                                    <Star size={16} fill="#FF9500" color="#FF9500" />
                                                    <span style={{ position: 'absolute', fontSize: '9px', color: '#fff', fontWeight: 'bold', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '1px' }}>S</span>
                                                </div>
                                            )}
                                            {tea.favoriteK && (
                                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '6px' }}>
                                                    <Star size={16} fill="#34C759" color="#34C759" />
                                                    <span style={{ position: 'absolute', fontSize: '9px', color: '#fff', fontWeight: 'bold', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '1px' }}>K</span>
                                                </div>
                                            )}
                                            {tea.name || "Unnamed Tea"}
                                        </h4>
                                        <p>{teaCats.length > 0 ? teaCats.join(', ') : 'No Categories selected'}</p>
                                    </div>
                                    <div className="compact-actions">
                                        {!tea.inStock && <span className="admin-compact-badge">Out of Stock</span>}
                                        {isExpanded ? <ChevronUp size={20} className="icon-muted" /> : <ChevronDown size={20} className="icon-muted" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="admin-expanded-content">
                                        <div className="admin-fields">

                                            <div className="field-group hero-field">
                                                <input value={tea.name} onChange={e => updateTea(tea.id, 'name', e.target.value)} placeholder="Type the tea's name..." className="admin-input-title" />
                                            </div>

                                            <div className="field-group">
                                                <label>Categories & Sub-categories</label>
                                                <div className="category-selector-structured">
                                                    {Object.entries(CATEGORY_STRUCTURE).map(([parent, presetSubs]) => {
                                                        const parentSelected = teaCats.includes(parent);
                                                        const customSubs = existingCategories.filter(c =>
                                                            !ALL_KNOWN_CATEGORIES.has(c) && getParentCategory(c) === parent
                                                        );
                                                        const allSubs = [...presetSubs, ...customSubs];

                                                        return (
                                                            <div key={parent} className="cat-group-compact">
                                                                <button
                                                                    className={`cat-toggle-btn cat-parent-btn ${parentSelected ? 'selected' : ''}`}
                                                                    onClick={() => toggleTeaCategory(tea.id, parent)}
                                                                >
                                                                    {parentSelected && <Check size={12} />} {parent}
                                                                </button>
                                                                {allSubs.length > 0 && (
                                                                    <div className="cat-sub-inline">
                                                                        {allSubs.map(sub => {
                                                                            const subSelected = teaCats.includes(sub);
                                                                            return (
                                                                                <button
                                                                                    key={sub}
                                                                                    className={`cat-toggle-btn cat-sub-btn ${subSelected ? 'selected' : ''}`}
                                                                                    onClick={() => toggleTeaCategory(tea.id, sub)}
                                                                                >
                                                                                    {subSelected && <Check size={10} />} {sub}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="new-category-input">
                                                    <input
                                                        value={newCatInputs[tea.id] || ''}
                                                        onChange={e => setNewCatInputs(prev => ({ ...prev, [tea.id]: e.target.value }))}
                                                        onKeyDown={e => e.key === 'Enter' && addNewCategory(tea.id)}
                                                        placeholder="Add a custom sub-category..."
                                                        className="admin-input small-input"
                                                    />
                                                    <button className="icon-btn" onClick={() => addNewCategory(tea.id)}>
                                                        <PlusCircle size={20} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="admin-field-row auto-grid">
                                                <div className="field-group">
                                                    <label>Origin</label>
                                                    <input list="origins-list" value={tea.origin} onChange={e => updateTea(tea.id, 'origin', e.target.value)} placeholder="e.g. Kyoto, Japan" className="admin-input" />
                                                </div>
                                                <div className="field-group">
                                                    <label>Brew Time</label>
                                                    <input list="brews-list" value={tea.brewTime} onChange={e => updateTea(tea.id, 'brewTime', e.target.value)} placeholder="e.g. 3-4 mins" className="admin-input" />
                                                </div>
                                                <div className="field-group">
                                                    <label>Temperature</label>
                                                    <input list="temps-list" value={tea.temperature} onChange={e => updateTea(tea.id, 'temperature', e.target.value)} placeholder="e.g. 85°C" className="admin-input" />
                                                </div>
                                            </div>

                                            <div className="field-group">
                                                <label>Description</label>
                                                <textarea value={tea.description || ''} onChange={e => updateTea(tea.id, 'description', e.target.value)} placeholder="Describe the flavour, aroma, and notes..." className="admin-input admin-textarea" />
                                            </div>

                                            <div className="field-group">
                                                <label>Flavour Notes</label>
                                                <input value={tea.flavourNotes || ''} onChange={e => updateTea(tea.id, 'flavourNotes', e.target.value)} placeholder="e.g. Earthy herbs, mild sweetness" className="admin-input" />
                                            </div>

                                            <div className="field-group">
                                                <label>Pro Tips</label>
                                                <input value={tea.tips || ''} onChange={e => updateTea(tea.id, 'tips', e.target.value)} placeholder="e.g. Makes a good iced tea..." className="admin-input" />
                                            </div>

                                            <div className="field-group hero-field">
                                                <label>AI Semantic Profile (Emotions, Scenarios & Concepts)</label>
                                                <textarea value={tea.aiSemanticProfile || ''} onChange={e => updateTea(tea.id, 'aiSemanticProfile', e.target.value)} placeholder="e.g. cozy, rainy day, relaxing, deep thought, nostalgic..." className="admin-input admin-textarea" />
                                            </div>

                                            <div className="field-group hero-field">
                                                <label>Tasting Profile Scales</label>
                                                <div className="admin-field-row auto-grid">
                                                    <div>
                                                        <label style={{fontSize: '11px', color: 'var(--text-secondary)'}}>Intensity (Mild → Bold)</label>
                                                        <input type="range" min="5" max="95" value={tea.scales?.intensity || 50} onChange={e => updateScale(tea.id, 'intensity', e.target.value)} style={{width: '100%', accentColor: 'var(--accent-color)'}} />
                                                    </div>
                                                    <div>
                                                        <label style={{fontSize: '11px', color: 'var(--text-secondary)'}}>Mouthfeel (Smooth → Brisk)</label>
                                                        <input type="range" min="5" max="95" value={tea.scales?.mouthfeel || 50} onChange={e => updateScale(tea.id, 'mouthfeel', e.target.value)} style={{width: '100%', accentColor: 'var(--accent-color)'}} />
                                                    </div>
                                                    <div>
                                                        <label style={{fontSize: '11px', color: 'var(--text-secondary)'}}>Flavor (Bright → Roasted)</label>
                                                        <input type="range" min="5" max="95" value={tea.scales?.flavor || 50} onChange={e => updateScale(tea.id, 'flavor', e.target.value)} style={{width: '100%', accentColor: 'var(--accent-color)'}} />
                                                    </div>
                                                    <div>
                                                        <label style={{fontSize: '11px', color: 'var(--text-secondary)'}}>Sweetness (Sweet → Savory)</label>
                                                        <input type="range" min="5" max="95" value={tea.scales?.sweetness || 50} onChange={e => updateScale(tea.id, 'sweetness', e.target.value)} style={{width: '100%', accentColor: 'var(--accent-color)'}} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="admin-field-row auto-grid">
                                                <div className="field-group">
                                                    <label>Caffeinated</label>
                                                    <select value={tea.caffeinated || 'Unknown'} onChange={e => updateTea(tea.id, 'caffeinated', e.target.value)} className="admin-input">
                                                        <option value="Yes">Yes</option>
                                                        <option value="No">No</option>
                                                        <option value="Unknown">Unknown</option>
                                                    </select>
                                                </div>
                                                <div className="field-group">
                                                    <label>Brand</label>
                                                    <input value={tea.brand || ''} onChange={e => updateTea(tea.id, 'brand', e.target.value)} placeholder="Brand name" className="admin-input" />
                                                </div>
                                                <div className="field-group">
                                                    <label>Location</label>
                                                    <input value={tea.location || ''} onChange={e => updateTea(tea.id, 'location', e.target.value)} placeholder="Storage location" className="admin-input" />
                                                </div>
                                            </div>

                                            <div className="admin-field-row auto-grid">
                                                <div className="field-group">
                                                    <label>Type / Format</label>
                                                    <input value={tea.typeFormat || ''} onChange={e => updateTea(tea.id, 'typeFormat', e.target.value)} placeholder="e.g. Loose leaf, Teabag" className="admin-input" />
                                                </div>
                                                <div className="field-group">
                                                    <label>Acquired Year</label>
                                                    <input value={tea.acquiredYear || ''} onChange={e => updateTea(tea.id, 'acquiredYear', e.target.value)} placeholder="e.g. 2024" className="admin-input" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="admin-card-footer">
                                            <div className="admin-toggles" style={{ flexWrap: 'wrap', gap: '8px' }}>
                                                <label className="admin-toggle-switch favorite-toggle">
                                                    <input type="checkbox" checked={!!tea.favoriteS} onChange={e => updateTea(tea.id, 'favoriteS', e.target.checked)} />
                                                    <span className="toggle-slider"></span>
                                                    <span>S Favorite</span>
                                                </label>
                                                <label className="admin-toggle-switch favorite-toggle">
                                                    <input type="checkbox" checked={!!tea.favoriteK} onChange={e => updateTea(tea.id, 'favoriteK', e.target.checked)} />
                                                    <span className="toggle-slider"></span>
                                                    <span>K Favorite</span>
                                                </label>

                                                <label className="admin-toggle-switch">
                                                    <input type="checkbox" checked={tea.inStock} onChange={e => updateTea(tea.id, 'inStock', e.target.checked)} />
                                                    <span className="toggle-slider"></span>
                                                    <span>In Stock</span>
                                                </label>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="admin-btn action-btn-icon" onClick={(e) => { e.stopPropagation(); duplicateTea(tea.id); }} title="Duplicate Tea">
                                                    <Copy size={16} /> Duplicate
                                                </button>
                                                <button className="admin-btn remove-btn-icon" onClick={(e) => { e.stopPropagation(); removeTea(tea.id); }} title="Delete Tea">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
