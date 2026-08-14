import { useState, useEffect, useRef } from 'react';
import { initialPoliticalTheory } from './data/political_theory';
import { chaogePoliticalTheory } from './data/political_theory_chaoge';
import './App.css';

const getShortMeaning = (meaning) => {
  if (!meaning) return "";
  
  let parts = meaning.split('。')
    .map(p => p.trim())
    .filter(p => {
      if (!p) return false;
      if (p.includes('：') || p.includes(':')) return false;
      const isSynonymRef = p.startsWith('同“') || p.startsWith('同"') || p.startsWith('同「');
      return !isSynonymRef;
    });
    
  if (parts.length === 0) {
    return meaning;
  }
  
  const keywords = ['指', '是指', '是', '即', '属于', '体现了', '决定', '要求', '标志', '作为'];
  let firstKwIdx = -1;
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    if (keywords.some(kw => part.includes(kw))) {
      firstKwIdx = idx;
      break;
    }
  }
  
  if (firstKwIdx !== -1) {
    parts = parts.slice(firstKwIdx);
  }
  
  const result = parts.join('。') + (meaning.endsWith('。') ? '。' : '');
  if (result.replace(/[。，；、“”‘’（）]/g, '').trim().length > 1) {
    return result;
  }
  
  return meaning;
};

function App() {
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [stats, setStats] = useState({ known: 0, unsure: 0, unknown: 0 });
  const [filter, setFilter] = useState('all'); // 'all', 'known', 'unsure', 'unknown'
  const [isRandom, setIsRandom] = useState(() => {
    return localStorage.getItem('pt-tracker-random') === 'true';
  });
  const [activeMode, setActiveMode] = useState(() => {
    return localStorage.getItem('pt-tracker-active-mode') || 'contrast';
  }); // 'quiz', 'speed', 'contrast'
  const [dataSource, setDataSource] = useState(() => {
    return localStorage.getItem('pt-tracker-datasource') || 'huasheng';
  }); // 'huasheng', 'chaoge'
  const [hideBlanksInSpeedMode, setHideBlanksInSpeedMode] = useState(true);
  const [currentExample, setCurrentExample] = useState('');
  const [history, setHistory] = useState([]);

  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  
  const cardBackInnerRef = useRef(null);
  const [cardHeight, setCardHeight] = useState('340px');

  useEffect(() => {
    localStorage.setItem('pt-tracker-random', isRandom);
  }, [isRandom]);

  useEffect(() => {
    localStorage.setItem('pt-tracker-active-mode', activeMode);
  }, [activeMode]);

  useEffect(() => {
    localStorage.setItem('pt-tracker-datasource', dataSource);
  }, [dataSource]);

  // Load from local storage or initial
  useEffect(() => {
    const storageKey = dataSource === 'huasheng' ? 'pt-tracker-v11' : 'pt-tracker-v11-chaoge';
    const stored = localStorage.getItem(storageKey);
    let loadedItems = [];
    if (stored) {
      try {
        loadedItems = JSON.parse(stored);
      } catch (e) {
        loadedItems = [];
      }
    }
    
    if (!loadedItems || loadedItems.length === 0) {
      const sourceData = dataSource === 'huasheng' ? initialPoliticalTheory : chaogePoliticalTheory;
      loadedItems = sourceData.map(item => ({
        ...item,
        status: 'new'
      }));
      localStorage.setItem(storageKey, JSON.stringify(loadedItems));
    }
    setItems(loadedItems);

    const isRandomStored = localStorage.getItem('pt-tracker-random') === 'true';
    if (isRandomStored && loadedItems.length > 0) {
      const candidateIndices = [];
      loadedItems.forEach((item, index) => {
        if (item.status !== 'known') {
          candidateIndices.push(index);
        }
      });

      if (candidateIndices.length > 0) {
        const randIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
        setCurrentIndex(randIndex);
      } else {
        setCurrentIndex(randIndex);
      }
    } else {
      setCurrentIndex(0);
    }
    
    setHistory([]);
    setIsFlipped(false);
    setSelectedOption(null);
  }, [dataSource]);

  // Update stats
  useEffect(() => {
    if (items.length > 0) {
      const known = items.filter(i => i.status === 'known').length;
      const unsure = items.filter(i => i.status === 'unsure').length;
      const unknown = items.filter(i => i.status === 'unknown').length;
      setStats({ known, unsure, unknown });
      const storageKey = dataSource === 'huasheng' ? 'pt-tracker-v11' : 'pt-tracker-v11-chaoge';
      localStorage.setItem(storageKey, JSON.stringify(items));
    }
  }, [items, dataSource]);

  // Filtered by chapter
  const currentCategoryItems = items.filter(item => {
    if (selectedCategory === 'all') return true;
    return item.chapter === selectedCategory;
  });

  const currentItem = currentCategoryItems[currentIndex] || null;

  // Category switch
  useEffect(() => {
    if (currentCategoryItems.length === 0) return; // Prevent overwriting during initial load
    
    if (isRandom) {
      setCurrentIndex(Math.floor(Math.random() * currentCategoryItems.length));
    } else {
      setCurrentIndex(0);
    }
    setIsFlipped(false);
    setSelectedOption(null);
  }, [selectedCategory, isRandom]); // Re-run when switching between random/sequential modes too

  // Dynamic Height
  useEffect(() => {
    setTimeout(() => {
      if (cardBackInnerRef.current) {
        const contentHeight = cardBackInnerRef.current.scrollHeight;
        setCardHeight(`${Math.max(340, contentHeight)}px`);
      }
    }, 50);
  }, [selectedOption, currentItem, isFlipped, activeMode]);

  // Shuffle options
  useEffect(() => {
    if (currentCategoryItems.length > 0 && currentItem && (activeMode === 'quiz' || activeMode === 'contrast')) {
      let distractors = currentItem.distractors || [];
      
      if (distractors.length < 3) {
        const sameGroupCandidates = currentCategoryItems.filter(i => i.group === currentItem.group && i.word !== currentItem.word);
        const shuffledGroupCandidates = [...sameGroupCandidates].sort(() => Math.random() - 0.5);
        const moreDistractors = shuffledGroupCandidates.slice(0, 3 - distractors.length);
        distractors = [...distractors, ...moreDistractors.map(d => ({ word: d.word, meaning: d.meaning, hint: d.hint || d.meaning }))];
      }

      if (distractors.length < 3) {
        const otherCandidates = items.filter(i => i.word !== currentItem.word && !distractors.some(d => d.word === i.word));
        const shuffledOtherCandidates = [...otherCandidates].sort(() => Math.random() - 0.5);
        const needed = 3 - distractors.length;
        distractors = [...distractors, ...shuffledOtherCandidates.slice(0, needed).map(d => ({ word: d.word, meaning: d.meaning, hint: d.hint || d.meaning }))];
      }

      const opts = [
        { 
          // 知识模式(card)：用 hint（语境提示，不含答案词）
          // 挖空模式(quiz)：用 word（待填入的词）
          text: activeMode === 'quiz' ? currentItem.word : (currentItem.hint || currentItem.meaning), 
          fullText: currentItem.meaning,
          isCorrect: true,
          word: currentItem.word
        },
        ...distractors.slice(0, 3).map(d => ({
          text: activeMode === 'quiz' ? d.word : (d.hint || d.meaning),
          fullText: d.meaning,
          isCorrect: false,
          word: d.word
        }))
      ];
      
      const shuffled = [...opts].sort(() => Math.random() - 0.5);
      setShuffledOptions(shuffled);
      setSelectedOption(null);
      
      if (currentItem.examples && currentItem.examples.length > 0) {
        const randomEx = currentItem.examples[Math.floor(Math.random() * currentItem.examples.length)];
        setCurrentExample(randomEx);
      } else {
        setCurrentExample('');
      }
    }
  }, [currentIndex, currentCategoryItems.length, activeMode, selectedCategory]);

  const handleFilterClick = (targetFilter) => {
    if (filter === targetFilter) {
      setFilter('all');
      return;
    }
    const count = targetFilter === 'known' ? stats.known :
                  targetFilter === 'unsure' ? stats.unsure :
                  targetFilter === 'unknown' ? stats.unknown : 0;
    if (count === 0) {
      alert(`当前没有处于“${targetFilter === 'known' ? '已掌握' : targetFilter === 'unsure' ? '模糊' : '生词'}”状态的考点！`);
      return;
    }
    const targetIndex = currentCategoryItems.findIndex(i => i.status === targetFilter);
    if (targetIndex !== -1) {
      setFilter(targetFilter);
      setCurrentIndex(targetIndex);
      setIsFlipped(false);
      setSelectedOption(null);
    }
  };

  const handleNext = (status) => {
    if (!currentItem) return;

    const realIndex = items.findIndex(i => i.word === currentItem.word && i.group === currentItem.group);
    if (realIndex === -1) return;

    const updatedItems = [...items];
    updatedItems[realIndex].status = status;
    setItems(updatedItems);
    setIsFlipped(false);
    
    setHistory(prev => [...prev, currentIndex]);

    setTimeout(() => {
      let nextIndex = currentIndex;
      let activeFilter = filter;

      const updatedCategoryItems = updatedItems.filter(item => {
        if (selectedCategory === 'all') return true;
        return item.chapter === selectedCategory;
      });

      let candidates = [];
      if (filter !== 'all') {
        candidates = updatedCategoryItems
          .map((item, index) => ({ status: item.status, index }))
          .filter(item => item.status === filter)
          .map(item => item.index);
        
        if (candidates.length === 0) {
          activeFilter = 'all';
          setFilter('all');
          alert(`恭喜！你已复习完该分类下的所有考点，系统已自动切回“全部”模式。`);
        }
      }
      
      if (activeFilter === 'all') {
        if (isRandom) {
          const candidateIndices = [];
          updatedCategoryItems.forEach((item, index) => {
            if (item.status !== 'known') {
              candidateIndices.push(index);
            }
          });
          
          if (candidateIndices.length > 0) {
            let finalCandidates = candidateIndices;
            if (candidateIndices.length > 1) {
              finalCandidates = candidateIndices.filter(idx => idx !== currentIndex);
            }
            nextIndex = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
          } else {
            const allIndices = Array.from({length: updatedCategoryItems.length}, (_, i) => i);
            const otherIndices = allIndices.filter(idx => idx !== currentIndex);
            nextIndex = otherIndices.length > 0 
              ? otherIndices[Math.floor(Math.random() * otherIndices.length)]
              : 0;
          }
        } else {
          let found = false;
          for (let i = 0; i < updatedCategoryItems.length; i++) {
            let checkIndex = (currentIndex + 1 + i) % updatedCategoryItems.length;
            if (updatedCategoryItems[checkIndex].status !== 'known') {
              nextIndex = checkIndex;
              found = true;
              break;
            }
          }
          if (!found) {
            nextIndex = (currentIndex + 1) % updatedCategoryItems.length;
          }
        }
      } else {
        if (isRandom) {
          let finalCandidates = candidates;
          if (candidates.length > 1) {
            finalCandidates = candidates.filter(idx => idx !== currentIndex);
          }
          nextIndex = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
        } else {
          const nextCandidate = candidates.find(idx => idx > currentIndex);
          nextIndex = nextCandidate !== undefined ? nextCandidate : candidates[0];
        }
      }
      
      setCurrentIndex(nextIndex);
    }, 300);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (history.length > 0) {
      const prevIndex = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentIndex(prevIndex);
      setIsFlipped(false);
      setSelectedOption(null);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'known': return 'rgba(16, 185, 129, 0.8)';
      case 'unsure': return 'rgba(245, 158, 11, 0.8)';
      case 'unknown': return 'rgba(239, 68, 68, 0.8)';
      default: return 'rgba(107, 114, 128, 0.8)';
    }
  };

  if (!currentItem) return <div className="loading">加载政治理论题库中...</div>;

  const total = items.length;
  const progress = ((stats.known) / (total || 1)) * 100;

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <span>📚</span>
          <span className="title-text">政治理论题库</span>
        </h1>
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="stats">
            <button 
              className={`stat-item ${filter === 'known' ? 'active-known' : ''}`}
              onClick={() => handleFilterClick('known')}
              title="只复习已掌握"
            >
              <span className="dot dot-known"></span>
              已掌握: <span className="stat-count">{stats.known}</span>
            </button>
            <button 
              className={`stat-item ${filter === 'unsure' ? 'active-unsure' : ''}`}
              onClick={() => handleFilterClick('unsure')}
              title="只复习模糊"
            >
              <span className="dot dot-unsure"></span>
              模糊: <span className="stat-count">{stats.unsure}</span>
            </button>
            <button 
              className={`stat-item ${filter === 'unknown' ? 'active-unknown' : ''}`}
              onClick={() => handleFilterClick('unknown')}
              title="只复习生词"
            >
              <span className="dot dot-unknown"></span>
              生词: <span className="stat-count">{stats.unknown}</span>
            </button>
            <button 
              className={`stat-item ${filter === 'all' ? 'active-all' : ''}`}
              onClick={() => setFilter('all')}
              title="查看全部"
            >
              总计: <span className="stat-count">{total}</span>
            </button>
          </div>

          {/* 第一行修改：单行横向滑动章节栏 */}
          <div className="category-scroll-container">
            <div className="category-scroll-track">
              {dataSource === 'huasheng' ? [
                { key: 'all', label: '全部章节' },
                { key: '第一章 十五五规划专题', label: '🚩 十五五' },
                { key: '第二章 马克思主义基本原理', label: '🧠 马原政经' },
                { key: '第三章 习近平新时代思想', label: '🌟 习近平新思想' },
                { key: '第四章 最新重要方针政策', label: '🚀 方针政策' },
                { key: '第五章 2026新法典与时政考察', label: '⚖️ 2026新法典' },
              ].map(cat => (
                <button
                  key={cat.key}
                  className={`cat-chip ${selectedCategory === cat.key ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.key)}
                >
                  {cat.label}
                </button>
              )) : [
                { key: 'all', label: '全部章节' },
                { key: '超格精简版', label: '📚 超格精简' },
              ].map(cat => (
                <button
                  key={cat.key}
                  className={`cat-chip ${selectedCategory === cat.key ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 第二行修改：原版胶囊UI（修复手机端折行与间距） */}
          <div className="mode-toggle">
            <button className={`mode-btn ${dataSource === 'huasheng' ? 'active' : ''}`} onClick={() => setDataSource('huasheng')}>🥜 花生</button>
            <button className={`mode-btn ${dataSource === 'chaoge' ? 'active' : ''}`} onClick={() => setDataSource('chaoge')}>📖 超格</button>
            <span className="mode-divider"></span>
            <button className={`mode-btn ${activeMode === 'contrast' ? 'active' : ''}`} onClick={() => setActiveMode('contrast')}>易混辨析</button>
            <button className={`mode-btn ${activeMode === 'quiz' ? 'active' : ''}`} onClick={() => setActiveMode('quiz')}>挖空特训</button>
            <button className={`mode-btn ${activeMode === 'speed' ? 'active' : ''}`} onClick={() => setActiveMode('speed')}>速览速记</button>
            <span className="mode-divider"></span>
            <button className={`mode-btn ${!isRandom ? 'active' : ''}`} onClick={() => setIsRandom(false)}>顺序</button>
            <button className={`mode-btn ${isRandom ? 'active' : ''}`} onClick={() => setIsRandom(true)}>随机</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {(activeMode === 'quiz' || activeMode === 'contrast') && (
          <>
            <div className={`card-container ${selectedOption !== null ? 'expanded' : ''}`} style={{ height: cardHeight }} onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`card ${isFlipped ? 'flipped' : ''}`}>
                {/* 卡片正面 */}
                <div className="card-front">
                  {activeMode === 'quiz' ? (
                    <h2 className="idiom-word sentence-blank">
                      {currentExample ? currentExample.replace(new RegExp(currentItem.word, 'g'), '______') : '（暂无例句）'}
                    </h2>
                  ) : (
                <h2 
                  className="idiom-word"
                  style={(() => {
                    const len = (currentItem.word || '').length;
                    if (len <= 4) return { fontSize: '2.8rem', fontWeight: '800', letterSpacing: '0.1rem' };
                    if (len <= 8) return { fontSize: '2.0rem', fontWeight: '700', letterSpacing: '0.04rem', lineHeight: '1.35' };
                    if (len <= 14) return { fontSize: '1.5rem', fontWeight: '700', letterSpacing: '0.02rem', lineHeight: '1.4' };
                    return { fontSize: '1.25rem', fontWeight: '700', letterSpacing: '0', lineHeight: '1.45' };
                  })()}
                >
                  {currentItem.word}
                </h2>
                  )}
                  <div className="card-hint">点击翻转查看{activeMode === 'quiz' ? '选项' : '辨析题'}</div>
                  {currentItem.status !== 'new' && (
                <div className="status-badge" style={{backgroundColor: getStatusColor(currentItem.status)}}>
                  上次标记: {currentItem.status === 'known' ? '认识' : currentItem.status === 'unsure' ? '模糊' : '不认识'}
                </div>
              )}
            </div>

            {/* 卡片反面 */}
            <div className="card-back">
              <div className="card-back-inner" ref={cardBackInnerRef}>
                <div className="group-tag">
                  {currentItem.group} {currentItem.subcategory ? `· ${currentItem.subcategory}` : ''}
                </div>
                <div className="card-back-content">
                  {activeMode === 'quiz' ? (
                    <div className="sentence-question">
                      {currentExample ? currentExample.replace(new RegExp(currentItem.word, 'g'), '______') : '（暂无例句）'}
                    </div>
                  ) : (
                    <h3>{currentItem.word}</h3>
                  )}
                  <div className="quiz-title">请选择正确的{activeMode === 'quiz' ? '考点词' : '辨析释义'}：</div>
                  <div className={`options-container ${activeMode === 'quiz' ? 'options-grid-2x2' : ''} ${selectedOption === null ? 'quiz-not-answered' : ''}`}>
                    {shuffledOptions.map((opt, index) => {
                      let btnClass = "option-btn";
                      if (selectedOption !== null) {
                        if (opt.isCorrect) {
                          btnClass += " correct";
                        } else if (selectedOption === index) {
                          btnClass += " incorrect";
                        }
                        btnClass += " disabled";
                      }
                      return (
                        <button
                          key={index}
                          className={btnClass}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedOption === null) {
                              setSelectedOption(index);
                            }
                          }}
                          disabled={selectedOption !== null}
                        >
                          <span className="option-label">{['A', 'B', 'C', 'D'][index]}. </span>
                          <span className={activeMode === 'quiz' ? 'option-text-word' : 'option-text'}>{opt.text}</span>
                          {selectedOption !== null && opt.isCorrect && (
                            <span className="option-status-icon correct-icon">✓</span>
                          )}
                          {selectedOption !== null && !opt.isCorrect && selectedOption === index && (
                            <span className="option-status-icon incorrect-icon">✗</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOption !== null && (() => {
                    const distractorOpts = shuffledOptions.filter(o => !o.isCorrect);
                    return (
                      <div className="quiz-feedback-details">
                        <div className="full-definition-container">
                          <strong>【{currentItem.word}】的权威表述</strong>
                          <span className="full-definition-text">{currentItem.meaning}</span>
                        </div>

                        {distractorOpts.map((opt, idx) => {
                          const isUserSelected = selectedOption !== null && shuffledOptions[selectedOption] === opt;
                          return (
                            <div key={idx} className={`full-definition-container distractor-definition ${isUserSelected ? 'user-selected-distractor' : ''}`}>
                              <strong>
                                【{opt.word}】的相关表述
                                {isUserSelected && " - 你误选了此项"}
                              </strong>
                              <span className="full-definition-text">{opt.fullText}</span>
                            </div>
                          );
                        })}

                        {currentItem.examples && currentItem.examples.length > 0 && (
                          <div className="examples-container">
                            {currentItem.examples.map((ex, exIdx) => {
                              const isCurrentExample = activeMode === 'quiz' && ex === currentExample;
                              return (
                                <div key={exIdx} className={`example-item ${isCurrentExample ? 'highlighted-example' : ''}`}>
                                  <strong>官方原文：</strong>
                                  {isCurrentExample ? (
                                    <span>
                                      {ex.split(new RegExp(`(${currentItem.word})`, 'g')).map((part, i) => 
                                        part === currentItem.word ? <span key={i} className="filled-idiom">{part}</span> : part
                                      )}
                                    </span>
                                  ) : ex}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {activeMode === 'contrast' && selectedOption !== null && (
                      <div className="contrast-explanation" style={{marginTop: '1rem', textAlign: 'left'}}>
                        <div className="explanation-title" style={{fontSize: '0.9rem', marginBottom: '0.5rem'}}>📝 辨析解析：</div>
                        <div className="explanation-item" style={{marginBottom: '0.4rem'}}>
                          <span className="exp-word" style={{fontWeight: 'bold', color: 'var(--success)'}}>{currentItem.word}：</span>
                          <span className="exp-meaning" style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>{currentItem.meaning}</span>
                        </div>
                        {currentItem.distractors && currentItem.distractors.map((d, dIdx) => (
                          <div key={dIdx} className="explanation-item distractor-exp" style={{marginBottom: '0.4rem', paddingLeft: '0.5rem', borderLeft: '2px solid #e2e8f0'}}>
                            <span className="exp-word" style={{fontWeight: 'bold', color: '#64748b'}}>{d.word}：</span>
                            <span className="exp-meaning" style={{fontSize: '0.85rem', color: '#94a3b8'}}>{d.meaning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部操作按钮 */}
          <div className={`action-buttons ${(!isFlipped || selectedOption === null) ? 'hidden' : ''}`}>
            <button className="btn btn-prev" onClick={handlePrev} disabled={history.length === 0}>
              上一题
            </button>
            <button className="btn btn-unknown" onClick={(e) => { e.stopPropagation(); handleNext('unknown'); }}>
              不认识
            </button>
            <button className="btn btn-unsure" onClick={(e) => { e.stopPropagation(); handleNext('unsure'); }}>
              模糊
            </button>
            <button className="btn btn-known" onClick={(e) => { e.stopPropagation(); handleNext('known'); }}>
              认识
            </button>
          </div>
        </>
        )}

        {/* 扩展模式：速览速记 */}
        {activeMode === 'speed' && (
          <div className="list-mode-container">
            <div className="list-mode-header">
              <h3>速览速记 - {currentCategoryItems.length} 个考点</h3>
              <button className="toggle-mask-btn" onClick={() => setHideBlanksInSpeedMode(!hideBlanksInSpeedMode)}>
                {hideBlanksInSpeedMode ? '👀 揭晓全部' : '🙈 遮挡考点'}
              </button>
            </div>
            {currentCategoryItems.map((item, idx) => {
              const displayEx = item.examples && item.examples.length > 0 ? item.examples[0] : item.meaning;
              const parts = displayEx.split(new RegExp(`(${item.word})`, 'g'));
              return (
                <div key={idx} className="speed-item-card">
                  <div className="speed-word-row">
                    <span className="speed-label">考点 {idx + 1}</span>
                    <span 
                      className={`speed-blank ${hideBlanksInSpeedMode ? 'masked' : 'revealed'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.currentTarget.classList.toggle('revealed');
                        e.currentTarget.classList.toggle('masked');
                      }}
                      title={hideBlanksInSpeedMode ? '点击揭晓' : '点击遮挡'}
                    >
                      {item.word}
                    </span>
                  </div>
                  <div className="speed-meaning">
                    {parts.map((part, i) => 
                      part === item.word ? <strong key={i} style={{color: 'var(--accent-color)'}}>{part}</strong> : part
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}


        
        {/* 重置进度 */}
        <div className="controls">
          <button className="btn-text" onClick={() => {
            if(window.confirm(`确定要重置当前数据库（${dataSource === 'huasheng' ? '花生' : '超格'}）的学习进度吗？`)) {
              const storageKey = dataSource === 'huasheng' ? 'pt-tracker-v11' : 'pt-tracker-v11-chaoge';
              localStorage.removeItem(storageKey);
              window.location.reload();
            }
          }}>
            <svg className="reset-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <span className="reset-text">重置进度</span>
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
