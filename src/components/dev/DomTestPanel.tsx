/**
 * Development-only UI panel for testing DOM mismatch detection and recovery.
 * Only rendered when NODE_ENV === 'development'
 */

import React, { useCallback, useEffect, useState } from 'react';

import {
  devTestService,
  type ScenarioResult,
  type TestResult,
  type ValidationLogEntry,
} from '../../services/DevTestService';
import { domService, type ElementFingerprint, type ValidationResult } from '../../services/DomService';

interface IndexedElement {
  index: number;
  fingerprint: ElementFingerprint;
  element: HTMLElement | null;
}

export const DomTestPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'elements' | 'simulate' | 'scenarios' | 'log'>('elements');
  const [indexedElements, setIndexedElements] = useState<IndexedElement[]>([]);
  const [validationLog, setValidationLog] = useState<ValidationLogEntry[]>([]);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<ScenarioResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [commandInput, setCommandInput] = useState<string>('click_element');

  // Refresh indexed elements
  const refreshElements = useCallback(() => {
    const elements = devTestService.getIndexedElements();
    setIndexedElements(elements);
  }, []);

  // Refresh validation log
  const refreshLog = useCallback(() => {
    setValidationLog(devTestService.getValidationLog());
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshElements();
      refreshLog();
    }
  }, [isOpen, refreshElements, refreshLog]);

  // Re-index DOM
  const handleReindex = useCallback(() => {
    domService.indexInteractableElements();
    refreshElements();
  }, [refreshElements]);

  // Simulate agent command
  const handleSimulateCommand = useCallback(async () => {
    const result = await devTestService.simulateAgentCommand(commandInput, {
      index: selectedIndex,
    });
    setLastResult(result);
    refreshLog();
    refreshElements();
  }, [commandInput, selectedIndex, refreshLog, refreshElements]);

  // Run scenario
  const handleRunScenario = useCallback(
    async (scenarioId: string) => {
      const result = await devTestService.runScenario(scenarioId);
      setScenarioResults(prev => [...prev, result]);
      refreshLog();
      refreshElements();
    },
    [refreshLog, refreshElements],
  );

  // Run all scenarios
  const handleRunAllScenarios = useCallback(async () => {
    const results = await devTestService.runAllScenarios();
    setScenarioResults(results);
    refreshLog();
    refreshElements();
  }, [refreshLog, refreshElements]);

  // DOM mutation handlers
  const handleInsertBefore = useCallback(() => {
    devTestService.insertElementBefore(selectedIndex);
    refreshElements();
  }, [selectedIndex, refreshElements]);

  const handleRemoveElement = useCallback(() => {
    devTestService.removeElement(selectedIndex);
    refreshElements();
  }, [selectedIndex, refreshElements]);

  const handleSimulateRerender = useCallback(() => {
    devTestService.simulateRerender(selectedIndex);
    refreshElements();
  }, [selectedIndex, refreshElements]);

  const handleChangeContent = useCallback(() => {
    devTestService.changeElementContent(selectedIndex, `Modified Text ${Date.now()}`);
    refreshElements();
  }, [selectedIndex, refreshElements]);

  const handleCleanup = useCallback(() => {
    devTestService.cleanupTestElements();
    refreshElements();
  }, [refreshElements]);

  const handleShowModal = useCallback(() => {
    devTestService.showModal();
  }, []);

  const handleCreateIframe = useCallback(() => {
    devTestService.createIframeWithButton();
  }, []);

  const handleCreateShadowDom = useCallback(() => {
    devTestService.createShadowDomElement();
  }, []);

  // Validation status color
  const getValidationColor = (validation: ValidationResult): string => {
    if (validation.isValid) return '#4caf50'; // Green
    return '#f44336'; // Red - element changed or removed
  };

  const getOutcomeColor = (outcome: string): string => {
    switch (outcome) {
      case 'executed':
        return '#4caf50';
      case 'recovered':
        return '#ff9800';
      case 'failed':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 99999,
          padding: '8px 16px',
          background: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        DOM Test Panel
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        width: '500px',
        maxHeight: '600px',
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        zIndex: 99999,
        fontFamily: 'monospace',
        fontSize: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 15px',
          background: '#2196f3',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>DOM Test Panel (Dev Only)</span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          x
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {(['elements', 'simulate', 'scenarios', 'log'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              background: activeTab === tab ? '#e3f2fd' : 'transparent',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #2196f3' : 'none',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
        {/* Elements Tab */}
        {activeTab === 'elements' && (
          <div>
            <div style={{ marginBottom: '10px', display: 'flex', gap: '5px' }}>
              <button onClick={handleReindex} style={buttonStyle}>
                Re-index DOM
              </button>
              <button onClick={refreshElements} style={buttonStyle}>
                Refresh
              </button>
              <span style={{ marginLeft: 'auto', color: '#666' }}>{indexedElements.length} elements</span>
            </div>

            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {indexedElements.map(({ index, fingerprint }) => {
                const validation = devTestService.forceValidation(index);
                return (
                  <div
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    style={{
                      padding: '8px',
                      marginBottom: '4px',
                      background: selectedIndex === index ? '#e3f2fd' : '#f5f5f5',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      borderLeft: `4px solid ${getValidationColor(validation)}`,
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>
                      [{index}] {fingerprint.tagName}
                      {fingerprint.id && ` #${fingerprint.id}`}
                    </div>
                    <div style={{ color: '#666', fontSize: '10px' }}>
                      {fingerprint.textContent?.slice(0, 50) || '(no text)'}
                    </div>
                    <div style={{ color: '#999', fontSize: '10px' }}>{fingerprint.selector.slice(0, 60)}...</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Simulate Tab */}
        {activeTab === 'simulate' && (
          <div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Target Index:</label>
              <input
                type='number'
                value={selectedIndex}
                onChange={e => setSelectedIndex(parseInt(e.target.value) || 0)}
                style={{ width: '100px', padding: '5px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Command:</label>
              <select
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                style={{ padding: '5px', marginRight: '10px' }}
              >
                <option value='click_element'>click_element</option>
                <option value='type_text'>type_text</option>
                <option value='send_keys'>send_keys</option>
              </select>
              <button onClick={handleSimulateCommand} style={{ ...buttonStyle, background: '#4caf50' }}>
                Execute
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>DOM Mutations:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                <button onClick={handleInsertBefore} style={buttonStyle}>
                  Insert Before
                </button>
                <button onClick={handleRemoveElement} style={{ ...buttonStyle, background: '#f44336' }}>
                  Remove
                </button>
                <button onClick={handleSimulateRerender} style={buttonStyle}>
                  Rerender
                </button>
                <button onClick={handleChangeContent} style={buttonStyle}>
                  Change Text
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Special Cases:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                <button onClick={handleShowModal} style={buttonStyle}>
                  Show Modal
                </button>
                <button onClick={handleCreateIframe} style={buttonStyle}>
                  Create iFrame
                </button>
                <button onClick={handleCreateShadowDom} style={buttonStyle}>
                  Shadow DOM
                </button>
              </div>
            </div>

            <button onClick={handleCleanup} style={{ ...buttonStyle, background: '#ff9800' }}>
              Cleanup Test Elements
            </button>

            {lastResult && (
              <div
                style={{
                  marginTop: '15px',
                  padding: '10px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  borderLeft: `4px solid ${getOutcomeColor(lastResult.outcome)}`,
                }}
              >
                <div style={{ fontWeight: 'bold' }}>Last Result:</div>
                <div>Command: {lastResult.command}</div>
                <div>Index: {lastResult.index}</div>
                <div style={{ color: getOutcomeColor(lastResult.outcome) }}>
                  Outcome: {lastResult.outcome.toUpperCase()}
                </div>
                <div style={{ fontSize: '10px', color: '#666' }}>{lastResult.details}</div>
              </div>
            )}
          </div>
        )}

        {/* Scenarios Tab */}
        {activeTab === 'scenarios' && (
          <div>
            <div style={{ marginBottom: '15px' }}>
              <button onClick={handleRunAllScenarios} style={{ ...buttonStyle, background: '#4caf50' }}>
                Run All Scenarios
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Individual Scenarios:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => handleRunScenario('index-shift-insert')} style={buttonStyle}>
                  Index Shift - Insert
                </button>
                <button onClick={() => handleRunScenario('index-shift-remove')} style={buttonStyle}>
                  Index Shift - Remove
                </button>
                <button onClick={() => handleRunScenario('element-content-change')} style={buttonStyle}>
                  Content Change
                </button>
                <button onClick={() => handleRunScenario('spa-rerender')} style={buttonStyle}>
                  SPA Re-render
                </button>
              </div>
            </div>

            {scenarioResults.length > 0 && (
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Results:</div>
                {scenarioResults.map((result, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px',
                      marginBottom: '4px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      borderLeft: `4px solid ${result.passed ? '#4caf50' : '#f44336'}`,
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>
                      {result.passed ? 'PASS' : 'FAIL'}: {result.scenarioName}
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>{result.summary}</div>
                  </div>
                ))}
                <button onClick={() => setScenarioResults([])} style={{ ...buttonStyle, marginTop: '10px' }}>
                  Clear Results
                </button>
              </div>
            )}
          </div>
        )}

        {/* Log Tab */}
        {activeTab === 'log' && (
          <div>
            <div style={{ marginBottom: '10px', display: 'flex', gap: '5px' }}>
              <button onClick={refreshLog} style={buttonStyle}>
                Refresh
              </button>
              <button
                onClick={() => {
                  devTestService.clearLog();
                  refreshLog();
                }}
                style={buttonStyle}
              >
                Clear
              </button>
              <span style={{ marginLeft: 'auto', color: '#666' }}>{validationLog.length} entries</span>
            </div>

            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {validationLog
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px',
                      marginBottom: '4px',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      borderLeft: `4px solid ${getValidationColor(entry.validation)}`,
                      fontSize: '10px',
                    }}
                  >
                    <div style={{ color: '#999' }}>{entry.timestamp.toLocaleTimeString()}</div>
                    <div style={{ fontWeight: 'bold' }}>{entry.action}</div>
                    <div>
                      Valid: {entry.validation.isValid ? 'Yes' : 'No'}
                      {entry.validation.mismatchReason && ` (${entry.validation.mismatchReason})`}
                    </div>
                    {entry.recoveryAction && <div style={{ color: '#ff9800' }}>Recovery: {entry.recoveryAction}</div>}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#2196f3',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '11px',
};

export default DomTestPanel;
