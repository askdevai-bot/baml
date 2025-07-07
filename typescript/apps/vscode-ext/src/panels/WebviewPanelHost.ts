import {
  type Disposable,
  type Uri,
  ViewColumn,
  type WebviewPanel,
  workspace,
} from 'vscode';
import * as vscode from 'vscode';
import { getPlaygroundPort } from '../plugins/language-server-client';
import type TelemetryReporter from '../telemetryReporter';
import { getNonce } from '../utils/getNonce';

import packageJson from '../../package.json'; // eslint-disable-line

// Manual debug toggle - set to true for debug mode, false for production
const DEBUG_MODE = false;

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class WebviewPanelHost {
  public static currentPanel: WebviewPanelHost | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _port: () => number;
  private _playgroundPort: number | null = null;

  /**
   * Gets the current playground port
   */
  public get playgroundPort(): number | null {
    return this._playgroundPort;
  }

  /**
   * The WebPanelView class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(
    panel: WebviewPanel,
    extensionUri: Uri,
    portLoader: () => number,
    private reporter?: TelemetryReporter,
  ) {
    this._panel = panel;
    this._port = portLoader;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Show initial loading state
    this._showLoadingState();
  }

  /**
   * Updates the playground port and refreshes the webview
   */
  public updatePlaygroundPort(port: number) {
    console.log(`WebviewPanelHost: Updating playground port to ${port}`);
    this._playgroundPort = port;
    this._updateWebviewContent();
  }

  /**
   * Shows the loading state while waiting for the LSP port
   */
  private _showLoadingState() {
    this._panel.webview.html = `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    background: linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 25%, #1a1a2e 50%, #0f0f1a 75%, #0a0a0f 100%);
                    color: #e8e8e8;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    overflow: hidden;
                }
                .loading-container {
                    text-align: center;
                    max-width: 400px;
                    padding: 40px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                .logo {
                    font-size: 32px;
                    margin-bottom: 16px;
                    color: #a855f7;
                    text-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
                }
                .spinner {
                    border: 3px solid rgba(168, 85, 247, 0.2);
                    border-top: 3px solid #a855f7;
                    border-radius: 50%;
                    width: 48px;
                    height: 48px;
                    animation: spin 1.2s linear infinite;
                    margin: 0 auto 24px;
                    box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .title {
                    font-size: 24px;
                    font-weight: 700;
                    margin-bottom: 8px;
                    color: #ffffff;
                    letter-spacing: -0.5px;
                }
                .subtitle {
                    font-size: 16px;
                    opacity: 0.8;
                    margin-bottom: 4px;
                    color: #d1d5db;
                }
                .debug-info {
                    font-size: 12px;
                    opacity: 0.6;
                    margin-top: 20px;
                    padding: 12px;
                    background: rgba(168, 85, 247, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(168, 85, 247, 0.2);
                    display: ${DEBUG_MODE ? 'block' : 'none'};
                }
                .debug-info div {
                    margin-bottom: 4px;
                }
                .debug-info div:last-child {
                    margin-bottom: 0;
                }
            </style>
        </head>
        <body>
            <div class="loading-container">
                <div class="spinner"></div>
                <div class="title">BAML Playground</div>
                <div class="subtitle">Waiting on Baml language server...</div>
                ${
                  DEBUG_MODE
                    ? `
                <div class="debug-info">
                    <div>Debug Mode: Active</div>
                    <div>Waiting for LSP port notification</div>
                    <div>Extension Version: ${packageJson.version}</div>
                </div>
                `
                    : ''
                }
            </div>
        </body>
        </html>`;
  }

  /**
   * Updates the webview content with the playground iframe
   */
  private _updateWebviewContent() {
    if (!this._playgroundPort) {
      // Still waiting for port from LSP
      return;
    }

    const nonce = getNonce();

    this._panel.webview.html = `<!DOCTYPE html>
        <html>
        <head>
            <meta http-equiv="Content-type" content="text/html;charset=UTF-8">

            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                font-src data:;
                style-src ${this._panel.webview.cspSource} 'unsafe-inline';
                script-src 'nonce-${nonce}';
                frame-src *;
                ">

            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100vh;
                    overflow: hidden;
                    background: linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 25%, #1a1a2e 50%, #0f0f1a 75%, #0a0a0f 100%);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .header {
                    background: rgba(168, 85, 247, 0.1);
                    color: #e8e8e8;
                    padding: 12px 20px;
                    border-bottom: 1px solid rgba(168, 85, 247, 0.2);
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    backdrop-filter: blur(10px);
                    display: ${DEBUG_MODE ? 'flex' : 'none'};
                }
                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .status-indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #a855f7;
                    animation: pulse 2s infinite;
                    box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
                }
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .iframe-container {
                    height: ${DEBUG_MODE ? 'calc(100vh - 57px)' : '100vh'};
                    position: relative;
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                    display: block;
                }
                .loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #e8e8e8;
                    text-align: center;
                    transition: opacity 0.3s ease;
                    background: rgba(168, 85, 247, 0.1);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid rgba(168, 85, 247, 0.2);
                    backdrop-filter: blur(10px);
                }
                .hidden {
                    opacity: 0;
                    pointer-events: none;
                }
                .port-info {
                    background: rgba(168, 85, 247, 0.2);
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 11px;
                    opacity: 0.8;
                    border: 1px solid rgba(168, 85, 247, 0.3);
                }
                .debug-info {
                    font-size: 11px;
                    opacity: 0.6;
                    margin-top: 8px;
                    padding: 8px;
                    background: rgba(168, 85, 247, 0.1);
                    border-radius: 6px;
                    border: 1px solid rgba(168, 85, 247, 0.2);
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-title">
                    <div class="status-indicator"></div>
                    <span>BAML Playground (LSP Mode)</span>
                </div>
                <div class="port-info">Port: ${this._playgroundPort}</div>
            </div>
            <div class="iframe-container">
                <div class="loading" id="loading">
                    <p>Connecting to playground...</p>
                    ${
                      DEBUG_MODE
                        ? `
                    <p style="font-size: 12px; opacity: 0.7;">http://localhost:${this._playgroundPort}</p>
                    <div class="debug-info">
                        <div>Debug Mode: Active</div>
                        <div>Connected to port: ${this._playgroundPort}</div>
                        <div>Extension Version: ${packageJson.version}</div>
                    </div>
                    `
                        : ''
                    }
                </div>
                <!--
                  Sandbox permissions explained:
                  - allow-scripts: Required for JavaScript execution
                  - allow-forms: Required for form submissions
                  - allow-same-origin: Required for accessing localStorage and other same-origin resources
                  - allow-modals: Allows alert/confirm/prompt dialogs
                  - allow-popups: Allows window.open() if needed
                  - allow-clipboard-read: Enables reading from clipboard (copy operations)
                  - allow-clipboard-write: Enables writing to clipboard (paste operations)
                -->
                <iframe
                    id="playground"
                    sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups allow-clipboard-read allow-clipboard-write allow-pointer-lock allow-downloads allow-forms"
                    allow="cross-origin-isolated; clipboard-read; clipboard-write; autoplay;"
                    src="http://localhost:${this._playgroundPort}/"
                ></iframe>
            </div>

            <script nonce="${nonce}">
                const iframe = document.getElementById('playground');
                const loading = document.getElementById('loading');

                // Hide loading indicator when iframe loads
                iframe.addEventListener('load', () => {
                    loading.classList.add('hidden');
                    sendVSCodeVars(); // Send theme vars on load
                });

                // Handle navigation attempts (optional)
                iframe.addEventListener('error', () => {
                    loading.innerHTML = '<p style="color: #f87171;">Failed to connect to playground server</p><p style="font-size: 12px;">Make sure the language server is running on port ${this._playgroundPort}</p>';
                    loading.classList.remove('hidden');
                });

                // --- THEME SYNC LOGIC ---
                function sendVSCodeVars() {
                    if (!iframe.contentWindow) return;
                    const styles = getComputedStyle(document.documentElement);
                    const vars = {
                        // Font variables
                        '--vscode-font-family': styles.getPropertyValue('--vscode-font-family'),
                        '--vscode-font-weight': styles.getPropertyValue('--vscode-font-weight'),
                        '--vscode-font-size': styles.getPropertyValue('--vscode-font-size'),
                        '--vscode-editor-font-family': styles.getPropertyValue('--vscode-editor-font-family'),
                        '--vscode-editor-font-weight': styles.getPropertyValue('--vscode-editor-font-weight'),
                        '--vscode-editor-font-size': styles.getPropertyValue('--vscode-editor-font-size'),
                        '--vscode-editor-font-features': styles.getPropertyValue('--vscode-editor-font-features'),
                        '--vscode-editor-letter-spacing': styles.getPropertyValue('--vscode-editor-letter-spacing'),
                        '--vscode-editor-line-height': styles.getPropertyValue('--vscode-editor-line-height'),

                        // Basic UI variables
                        '--vscode-foreground': styles.getPropertyValue('--vscode-foreground'),
                        '--vscode-disabledForeground': styles.getPropertyValue('--vscode-disabledForeground'),
                        '--vscode-errorForeground': styles.getPropertyValue('--vscode-errorForeground'),
                        '--vscode-descriptionForeground': styles.getPropertyValue('--vscode-descriptionForeground'),
                        '--vscode-icon-foreground': styles.getPropertyValue('--vscode-icon-foreground'),
                        '--vscode-focusBorder': styles.getPropertyValue('--vscode-focusBorder'),

                        // Text and link variables
                        '--text-link-decoration': styles.getPropertyValue('--text-link-decoration'),
                        '--vscode-textLink-foreground': styles.getPropertyValue('--vscode-textLink-foreground'),
                        '--vscode-textLink-activeForeground': styles.getPropertyValue('--vscode-textLink-activeForeground'),
                        '--vscode-textSeparator-foreground': styles.getPropertyValue('--vscode-textSeparator-foreground'),
                        '--vscode-textPreformat-foreground': styles.getPropertyValue('--vscode-textPreformat-foreground'),
                        '--vscode-textPreformat-background': styles.getPropertyValue('--vscode-textPreformat-background'),
                        '--vscode-textBlockQuote-background': styles.getPropertyValue('--vscode-textBlockQuote-background'),
                        '--vscode-textBlockQuote-border': styles.getPropertyValue('--vscode-textBlockQuote-border'),
                        '--vscode-textCodeBlock-background': styles.getPropertyValue('--vscode-textCodeBlock-background'),

                        // Sash and scrollbar
                        '--vscode-sash-hoverBorder': styles.getPropertyValue('--vscode-sash-hoverBorder'),
                        '--vscode-scrollbar-shadow': styles.getPropertyValue('--vscode-scrollbar-shadow'),
                        '--vscode-scrollbarSlider-background': styles.getPropertyValue('--vscode-scrollbarSlider-background'),
                        '--vscode-scrollbarSlider-hoverBackground': styles.getPropertyValue('--vscode-scrollbarSlider-hoverBackground'),
                        '--vscode-scrollbarSlider-activeBackground': styles.getPropertyValue('--vscode-scrollbarSlider-activeBackground'),

                        // Badge variables
                        '--vscode-badge-background': styles.getPropertyValue('--vscode-badge-background'),
                        '--vscode-badge-foreground': styles.getPropertyValue('--vscode-badge-foreground'),
                        '--vscode-activityWarningBadge-foreground': styles.getPropertyValue('--vscode-activityWarningBadge-foreground'),
                        '--vscode-activityWarningBadge-background': styles.getPropertyValue('--vscode-activityWarningBadge-background'),
                        '--vscode-activityErrorBadge-foreground': styles.getPropertyValue('--vscode-activityErrorBadge-foreground'),
                        '--vscode-activityErrorBadge-background': styles.getPropertyValue('--vscode-activityErrorBadge-background'),

                        // Progress and charts
                        '--vscode-progressBar-background': styles.getPropertyValue('--vscode-progressBar-background'),
                        '--vscode-chart-line': styles.getPropertyValue('--vscode-chart-line'),
                        '--vscode-chart-axis': styles.getPropertyValue('--vscode-chart-axis'),
                        '--vscode-chart-guide': styles.getPropertyValue('--vscode-chart-guide'),
                        '--vscode-charts-foreground': styles.getPropertyValue('--vscode-charts-foreground'),
                        '--vscode-charts-lines': styles.getPropertyValue('--vscode-charts-lines'),
                        '--vscode-charts-red': styles.getPropertyValue('--vscode-charts-red'),
                        '--vscode-charts-blue': styles.getPropertyValue('--vscode-charts-blue'),
                        '--vscode-charts-yellow': styles.getPropertyValue('--vscode-charts-yellow'),
                        '--vscode-charts-orange': styles.getPropertyValue('--vscode-charts-orange'),
                        '--vscode-charts-green': styles.getPropertyValue('--vscode-charts-green'),
                        '--vscode-charts-purple': styles.getPropertyValue('--vscode-charts-purple'),
                        '--vscode-charts-gray': styles.getPropertyValue('--vscode-charts-gray'),

                        // Editor variables
                        '--vscode-editor-background': styles.getPropertyValue('--vscode-editor-background'),
                        '--vscode-editor-foreground': styles.getPropertyValue('--vscode-editor-foreground'),
                        '--vscode-editorStickyScroll-background': styles.getPropertyValue('--vscode-editorStickyScroll-background'),
                        '--vscode-editorStickyScrollHover-background': styles.getPropertyValue('--vscode-editorStickyScrollHover-background'),
                        '--vscode-editorStickyScroll-shadow': styles.getPropertyValue('--vscode-editorStickyScroll-shadow'),
                        '--vscode-editorWidget-background': styles.getPropertyValue('--vscode-editorWidget-background'),
                        '--vscode-editorWidget-foreground': styles.getPropertyValue('--vscode-editorWidget-foreground'),
                        '--vscode-editorWidget-border': styles.getPropertyValue('--vscode-editorWidget-border'),
                        '--vscode-editorError-foreground': styles.getPropertyValue('--vscode-editorError-foreground'),
                        '--vscode-editorWarning-foreground': styles.getPropertyValue('--vscode-editorWarning-foreground'),
                        '--vscode-editorInfo-foreground': styles.getPropertyValue('--vscode-editorInfo-foreground'),
                        '--vscode-editorHint-foreground': styles.getPropertyValue('--vscode-editorHint-foreground'),
                        '--vscode-editorLink-activeForeground': styles.getPropertyValue('--vscode-editorLink-activeForeground'),

                        // Editor selection and highlights
                        '--vscode-editor-selectionBackground': styles.getPropertyValue('--vscode-editor-selectionBackground'),
                        '--vscode-editor-inactiveSelectionBackground': styles.getPropertyValue('--vscode-editor-inactiveSelectionBackground'),
                        '--vscode-editor-selectionHighlightBackground': styles.getPropertyValue('--vscode-editor-selectionHighlightBackground'),
                        '--vscode-editor-compositionBorder': styles.getPropertyValue('--vscode-editor-compositionBorder'),
                        '--vscode-editor-findMatchBackground': styles.getPropertyValue('--vscode-editor-findMatchBackground'),
                        '--vscode-editor-findMatchHighlightBackground': styles.getPropertyValue('--vscode-editor-findMatchHighlightBackground'),
                        '--vscode-editor-findRangeHighlightBackground': styles.getPropertyValue('--vscode-editor-findRangeHighlightBackground'),
                        '--vscode-editor-hoverHighlightBackground': styles.getPropertyValue('--vscode-editor-hoverHighlightBackground'),
                        '--vscode-editor-lineHighlightBorder': styles.getPropertyValue('--vscode-editor-lineHighlightBorder'),
                        '--vscode-editor-rangeHighlightBackground': styles.getPropertyValue('--vscode-editor-rangeHighlightBackground'),
                        '--vscode-editor-symbolHighlightBackground': styles.getPropertyValue('--vscode-editor-symbolHighlightBackground'),
                        '--vscode-editor-wordHighlightBackground': styles.getPropertyValue('--vscode-editor-wordHighlightBackground'),
                        '--vscode-editor-wordHighlightStrongBackground': styles.getPropertyValue('--vscode-editor-wordHighlightStrongBackground'),
                        '--vscode-editor-wordHighlightTextBackground': styles.getPropertyValue('--vscode-editor-wordHighlightTextBackground'),

                        // Editor hover widget
                        '--vscode-editorHoverWidget-background': styles.getPropertyValue('--vscode-editorHoverWidget-background'),
                        '--vscode-editorHoverWidget-foreground': styles.getPropertyValue('--vscode-editorHoverWidget-foreground'),
                        '--vscode-editorHoverWidget-border': styles.getPropertyValue('--vscode-editorHoverWidget-border'),
                        '--vscode-editorHoverWidget-statusBarBackground': styles.getPropertyValue('--vscode-editorHoverWidget-statusBarBackground'),
                        '--vscode-editorHoverWidget-highlightForeground': styles.getPropertyValue('--vscode-editorHoverWidget-highlightForeground'),

                        // Editor inlay hints
                        '--vscode-editorInlayHint-foreground': styles.getPropertyValue('--vscode-editorInlayHint-foreground'),
                        '--vscode-editorInlayHint-background': styles.getPropertyValue('--vscode-editorInlayHint-background'),
                        '--vscode-editorInlayHint-typeForeground': styles.getPropertyValue('--vscode-editorInlayHint-typeForeground'),
                        '--vscode-editorInlayHint-typeBackground': styles.getPropertyValue('--vscode-editorInlayHint-typeBackground'),
                        '--vscode-editorInlayHint-parameterForeground': styles.getPropertyValue('--vscode-editorInlayHint-parameterForeground'),
                        '--vscode-editorInlayHint-parameterBackground': styles.getPropertyValue('--vscode-editorInlayHint-parameterBackground'),

                        // Editor light bulb
                        '--vscode-editorLightBulb-foreground': styles.getPropertyValue('--vscode-editorLightBulb-foreground'),
                        '--vscode-editorLightBulbAutoFix-foreground': styles.getPropertyValue('--vscode-editorLightBulbAutoFix-foreground'),
                        '--vscode-editorLightBulbAi-foreground': styles.getPropertyValue('--vscode-editorLightBulbAi-foreground'),

                        // Editor snippets
                        '--vscode-editor-snippetTabstopHighlightBackground': styles.getPropertyValue('--vscode-editor-snippetTabstopHighlightBackground'),
                        '--vscode-editor-snippetFinalTabstopHighlightBorder': styles.getPropertyValue('--vscode-editor-snippetFinalTabstopHighlightBorder'),

                        // Diff editor
                        '--vscode-diffEditor-insertedTextBackground': styles.getPropertyValue('--vscode-diffEditor-insertedTextBackground'),
                        '--vscode-diffEditor-removedTextBackground': styles.getPropertyValue('--vscode-diffEditor-removedTextBackground'),
                        '--vscode-diffEditor-insertedLineBackground': styles.getPropertyValue('--vscode-diffEditor-insertedLineBackground'),
                        '--vscode-diffEditor-removedLineBackground': styles.getPropertyValue('--vscode-diffEditor-removedLineBackground'),
                        '--vscode-diffEditor-diagonalFill': styles.getPropertyValue('--vscode-diffEditor-diagonalFill'),
                        '--vscode-diffEditor-unchangedRegionBackground': styles.getPropertyValue('--vscode-diffEditor-unchangedRegionBackground'),
                        '--vscode-diffEditor-unchangedRegionForeground': styles.getPropertyValue('--vscode-diffEditor-unchangedRegionForeground'),
                        '--vscode-diffEditor-unchangedCodeBackground': styles.getPropertyValue('--vscode-diffEditor-unchangedCodeBackground'),
                        '--vscode-diffEditor-move.border': styles.getPropertyValue('--vscode-diffEditor-move.border'),
                        '--vscode-diffEditor-moveActive.border': styles.getPropertyValue('--vscode-diffEditor-moveActive.border'),
                        '--vscode-diffEditor-unchangedRegionShadow': styles.getPropertyValue('--vscode-diffEditor-unchangedRegionShadow'),

                        // Widget
                        '--vscode-widget-shadow': styles.getPropertyValue('--vscode-widget-shadow'),
                        '--vscode-widget-border': styles.getPropertyValue('--vscode-widget-border'),

                        // Toolbar
                        '--vscode-toolbar-hoverBackground': styles.getPropertyValue('--vscode-toolbar-hoverBackground'),
                        '--vscode-toolbar-activeBackground': styles.getPropertyValue('--vscode-toolbar-activeBackground'),

                        // Breadcrumb
                        '--vscode-breadcrumb-foreground': styles.getPropertyValue('--vscode-breadcrumb-foreground'),
                        '--vscode-breadcrumb-background': styles.getPropertyValue('--vscode-breadcrumb-background'),
                        '--vscode-breadcrumb-focusForeground': styles.getPropertyValue('--vscode-breadcrumb-focusForeground'),
                        '--vscode-breadcrumb-activeSelectionForeground': styles.getPropertyValue('--vscode-breadcrumb-activeSelectionForeground'),
                        '--vscode-breadcrumbPicker-background': styles.getPropertyValue('--vscode-breadcrumbPicker-background'),

                        // Merge editor
                        '--vscode-merge-currentHeaderBackground': styles.getPropertyValue('--vscode-merge-currentHeaderBackground'),
                        '--vscode-merge-currentContentBackground': styles.getPropertyValue('--vscode-merge-currentContentBackground'),
                        '--vscode-merge-incomingHeaderBackground': styles.getPropertyValue('--vscode-merge-incomingHeaderBackground'),
                        '--vscode-merge-incomingContentBackground': styles.getPropertyValue('--vscode-merge-incomingContentBackground'),
                        '--vscode-merge-commonHeaderBackground': styles.getPropertyValue('--vscode-merge-commonHeaderBackground'),
                        '--vscode-merge-commonContentBackground': styles.getPropertyValue('--vscode-merge-commonContentBackground'),

                        // Editor overview ruler
                        '--vscode-editorOverviewRuler-currentContentForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-currentContentForeground'),
                        '--vscode-editorOverviewRuler-incomingContentForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-incomingContentForeground'),
                        '--vscode-editorOverviewRuler-commonContentForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-commonContentForeground'),
                        '--vscode-editorOverviewRuler-findMatchForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-findMatchForeground'),
                        '--vscode-editorOverviewRuler-selectionHighlightForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-selectionHighlightForeground'),
                        '--vscode-editorOverviewRuler-border': styles.getPropertyValue('--vscode-editorOverviewRuler-border'),
                        '--vscode-editorOverviewRuler-rangeHighlightForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-rangeHighlightForeground'),
                        '--vscode-editorOverviewRuler-errorForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-errorForeground'),
                        '--vscode-editorOverviewRuler-warningForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-warningForeground'),
                        '--vscode-editorOverviewRuler-infoForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-infoForeground'),
                        '--vscode-editorOverviewRuler-bracketMatchForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-bracketMatchForeground'),
                        '--vscode-editorOverviewRuler-wordHighlightForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-wordHighlightForeground'),
                        '--vscode-editorOverviewRuler-wordHighlightStrongForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-wordHighlightStrongForeground'),
                        '--vscode-editorOverviewRuler-wordHighlightTextForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-wordHighlightTextForeground'),
                        '--vscode-editorOverviewRuler-commentForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-commentForeground'),
                        '--vscode-editorOverviewRuler-commentUnresolvedForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-commentUnresolvedForeground'),
                        '--vscode-editorOverviewRuler-modifiedForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-modifiedForeground'),
                        '--vscode-editorOverviewRuler-addedForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-addedForeground'),
                        '--vscode-editorOverviewRuler-deletedForeground': styles.getPropertyValue('--vscode-editorOverviewRuler-deletedForeground'),
                        '--vscode-editorOverviewRuler-inlineChatInserted': styles.getPropertyValue('--vscode-editorOverviewRuler-inlineChatInserted'),
                        '--vscode-editorOverviewRuler-inlineChatRemoved': styles.getPropertyValue('--vscode-editorOverviewRuler-inlineChatRemoved'),

                        // Problems
                        '--vscode-problemsErrorIcon-foreground': styles.getPropertyValue('--vscode-problemsErrorIcon-foreground'),
                        '--vscode-problemsWarningIcon-foreground': styles.getPropertyValue('--vscode-problemsWarningIcon-foreground'),
                        '--vscode-problemsInfoIcon-foreground': styles.getPropertyValue('--vscode-problemsInfoIcon-foreground'),

                        // Minimap
                        '--vscode-minimap-findMatchHighlight': styles.getPropertyValue('--vscode-minimap-findMatchHighlight'),
                        '--vscode-minimap-selectionOccurrenceHighlight': styles.getPropertyValue('--vscode-minimap-selectionOccurrenceHighlight'),
                        '--vscode-minimap-selectionHighlight': styles.getPropertyValue('--vscode-minimap-selectionHighlight'),
                        '--vscode-minimap-infoHighlight': styles.getPropertyValue('--vscode-minimap-infoHighlight'),
                        '--vscode-minimap-warningHighlight': styles.getPropertyValue('--vscode-minimap-warningHighlight'),
                        '--vscode-minimap-errorHighlight': styles.getPropertyValue('--vscode-minimap-errorHighlight'),
                        '--vscode-minimap-foregroundOpacity': styles.getPropertyValue('--vscode-minimap-foregroundOpacity'),
                        '--vscode-minimap-chatEditHighlight': styles.getPropertyValue('--vscode-minimap-chatEditHighlight'),
                        '--vscode-minimapSlider-background': styles.getPropertyValue('--vscode-minimapSlider-background'),
                        '--vscode-minimapSlider-hoverBackground': styles.getPropertyValue('--vscode-minimapSlider-hoverBackground'),
                        '--vscode-minimapSlider-activeBackground': styles.getPropertyValue('--vscode-minimapSlider-activeBackground'),
                        '--vscode-minimapGutter-modifiedBackground': styles.getPropertyValue('--vscode-minimapGutter-modifiedBackground'),
                        '--vscode-minimapGutter-addedBackground': styles.getPropertyValue('--vscode-minimapGutter-addedBackground'),
                        '--vscode-minimapGutter-deletedBackground': styles.getPropertyValue('--vscode-minimapGutter-deletedBackground'),

                        // Input
                        '--vscode-input-background': styles.getPropertyValue('--vscode-input-background'),
                        '--vscode-input-foreground': styles.getPropertyValue('--vscode-input-foreground'),
                        '--vscode-input-border': styles.getPropertyValue('--vscode-input-border'),
                        '--vscode-inputOption-activeBorder': styles.getPropertyValue('--vscode-inputOption-activeBorder'),
                        '--vscode-inputOption-hoverBackground': styles.getPropertyValue('--vscode-inputOption-hoverBackground'),
                        '--vscode-inputOption-activeBackground': styles.getPropertyValue('--vscode-inputOption-activeBackground'),
                        '--vscode-inputOption-activeForeground': styles.getPropertyValue('--vscode-inputOption-activeForeground'),
                        '--vscode-input-placeholderForeground': styles.getPropertyValue('--vscode-input-placeholderForeground'),
                        '--vscode-inputValidation-infoBackground': styles.getPropertyValue('--vscode-inputValidation-infoBackground'),
                        '--vscode-inputValidation-infoBorder': styles.getPropertyValue('--vscode-inputValidation-infoBorder'),
                        '--vscode-inputValidation-warningBackground': styles.getPropertyValue('--vscode-inputValidation-warningBackground'),
                        '--vscode-inputValidation-warningBorder': styles.getPropertyValue('--vscode-inputValidation-warningBorder'),
                        '--vscode-inputValidation-errorBackground': styles.getPropertyValue('--vscode-inputValidation-errorBackground'),
                        '--vscode-inputValidation-errorBorder': styles.getPropertyValue('--vscode-inputValidation-errorBorder'),

                        // Dropdown
                        '--vscode-dropdown-background': styles.getPropertyValue('--vscode-dropdown-background'),
                        '--vscode-dropdown-listBackground': styles.getPropertyValue('--vscode-dropdown-listBackground'),
                        '--vscode-dropdown-foreground': styles.getPropertyValue('--vscode-dropdown-foreground'),
                        '--vscode-dropdown-border': styles.getPropertyValue('--vscode-dropdown-border'),

                        // Button
                        '--vscode-button-foreground': styles.getPropertyValue('--vscode-button-foreground'),
                        '--vscode-button-separator': styles.getPropertyValue('--vscode-button-separator'),
                        '--vscode-button-background': styles.getPropertyValue('--vscode-button-background'),
                        '--vscode-button-hoverBackground': styles.getPropertyValue('--vscode-button-hoverBackground'),
                        '--vscode-button-border': styles.getPropertyValue('--vscode-button-border'),
                        '--vscode-button-secondaryForeground': styles.getPropertyValue('--vscode-button-secondaryForeground'),
                        '--vscode-button-secondaryBackground': styles.getPropertyValue('--vscode-button-secondaryBackground'),
                        '--vscode-button-secondaryHoverBackground': styles.getPropertyValue('--vscode-button-secondaryHoverBackground'),

                        // Radio
                        '--vscode-radio-activeForeground': styles.getPropertyValue('--vscode-radio-activeForeground'),
                        '--vscode-radio-activeBackground': styles.getPropertyValue('--vscode-radio-activeBackground'),
                        '--vscode-radio-activeBorder': styles.getPropertyValue('--vscode-radio-activeBorder'),
                        '--vscode-radio-inactiveBorder': styles.getPropertyValue('--vscode-radio-inactiveBorder'),
                        '--vscode-radio-inactiveHoverBackground': styles.getPropertyValue('--vscode-radio-inactiveHoverBackground'),

                        // Checkbox
                        '--vscode-checkbox-background': styles.getPropertyValue('--vscode-checkbox-background'),
                        '--vscode-checkbox-selectBackground': styles.getPropertyValue('--vscode-checkbox-selectBackground'),
                        '--vscode-checkbox-foreground': styles.getPropertyValue('--vscode-checkbox-foreground'),
                        '--vscode-checkbox-border': styles.getPropertyValue('--vscode-checkbox-border'),
                        '--vscode-checkbox-selectBorder': styles.getPropertyValue('--vscode-checkbox-selectBorder'),

                        // Keybinding
                        '--vscode-keybindingLabel-background': styles.getPropertyValue('--vscode-keybindingLabel-background'),
                        '--vscode-keybindingLabel-foreground': styles.getPropertyValue('--vscode-keybindingLabel-foreground'),
                        '--vscode-keybindingLabel-border': styles.getPropertyValue('--vscode-keybindingLabel-border'),
                        '--vscode-keybindingLabel-bottomBorder': styles.getPropertyValue('--vscode-keybindingLabel-bottomBorder'),
                        '--vscode-keybindingTable-headerBackground': styles.getPropertyValue('--vscode-keybindingTable-headerBackground'),
                        '--vscode-keybindingTable-rowsBackground': styles.getPropertyValue('--vscode-keybindingTable-rowsBackground'),

                        // List
                        '--vscode-list-focusOutline': styles.getPropertyValue('--vscode-list-focusOutline'),
                        '--vscode-list-activeSelectionBackground': styles.getPropertyValue('--vscode-list-activeSelectionBackground'),
                        '--vscode-list-activeSelectionForeground': styles.getPropertyValue('--vscode-list-activeSelectionForeground'),
                        '--vscode-list-activeSelectionIconForeground': styles.getPropertyValue('--vscode-list-activeSelectionIconForeground'),
                        '--vscode-list-inactiveSelectionBackground': styles.getPropertyValue('--vscode-list-inactiveSelectionBackground'),
                        '--vscode-list-hoverBackground': styles.getPropertyValue('--vscode-list-hoverBackground'),
                        '--vscode-list-hoverForeground': styles.getPropertyValue('--vscode-list-hoverForeground'),
                        '--vscode-list-dropBackground': styles.getPropertyValue('--vscode-list-dropBackground'),
                        '--vscode-list-dropBetweenBackground': styles.getPropertyValue('--vscode-list-dropBetweenBackground'),
                        '--vscode-list-highlightForeground': styles.getPropertyValue('--vscode-list-highlightForeground'),
                        '--vscode-list-focusHighlightForeground': styles.getPropertyValue('--vscode-list-focusHighlightForeground'),
                        '--vscode-list-invalidItemForeground': styles.getPropertyValue('--vscode-list-invalidItemForeground'),
                        '--vscode-list-errorForeground': styles.getPropertyValue('--vscode-list-errorForeground'),
                        '--vscode-list-warningForeground': styles.getPropertyValue('--vscode-list-warningForeground'),
                        '--vscode-listFilterWidget-background': styles.getPropertyValue('--vscode-listFilterWidget-background'),
                        '--vscode-listFilterWidget-outline': styles.getPropertyValue('--vscode-listFilterWidget-outline'),
                        '--vscode-listFilterWidget-noMatchesOutline': styles.getPropertyValue('--vscode-listFilterWidget-noMatchesOutline'),
                        '--vscode-listFilterWidget-shadow': styles.getPropertyValue('--vscode-listFilterWidget-shadow'),
                        '--vscode-list-filterMatchBackground': styles.getPropertyValue('--vscode-list-filterMatchBackground'),
                        '--vscode-list-deemphasizedForeground': styles.getPropertyValue('--vscode-list-deemphasizedForeground'),

                        // Tree
                        '--vscode-tree-indentGuidesStroke': styles.getPropertyValue('--vscode-tree-indentGuidesStroke'),
                        '--vscode-tree-inactiveIndentGuidesStroke': styles.getPropertyValue('--vscode-tree-inactiveIndentGuidesStroke'),
                        '--vscode-tree-tableColumnsBorder': styles.getPropertyValue('--vscode-tree-tableColumnsBorder'),
                        '--vscode-tree-tableOddRowsBackground': styles.getPropertyValue('--vscode-tree-tableOddRowsBackground'),

                        // Editor action list
                        '--vscode-editorActionList-background': styles.getPropertyValue('--vscode-editorActionList-background'),
                        '--vscode-editorActionList-foreground': styles.getPropertyValue('--vscode-editorActionList-foreground'),
                        '--vscode-editorActionList-focusForeground': styles.getPropertyValue('--vscode-editorActionList-focusForeground'),
                        '--vscode-editorActionList-focusBackground': styles.getPropertyValue('--vscode-editorActionList-focusBackground'),

                        // Menu
                        '--vscode-menu-border': styles.getPropertyValue('--vscode-menu-border'),
                        '--vscode-menu-foreground': styles.getPropertyValue('--vscode-menu-foreground'),
                        '--vscode-menu-background': styles.getPropertyValue('--vscode-menu-background'),
                        '--vscode-menu-selectionForeground': styles.getPropertyValue('--vscode-menu-selectionForeground'),
                        '--vscode-menu-selectionBackground': styles.getPropertyValue('--vscode-menu-selectionBackground'),
                        '--vscode-menu-separatorBackground': styles.getPropertyValue('--vscode-menu-separatorBackground'),

                        // Quick input
                        '--vscode-quickInput-background': styles.getPropertyValue('--vscode-quickInput-background'),
                        '--vscode-quickInput-foreground': styles.getPropertyValue('--vscode-quickInput-foreground'),
                        '--vscode-quickInputTitle-background': styles.getPropertyValue('--vscode-quickInputTitle-background'),
                        '--vscode-pickerGroup-foreground': styles.getPropertyValue('--vscode-pickerGroup-foreground'),
                        '--vscode-pickerGroup-border': styles.getPropertyValue('--vscode-pickerGroup-border'),
                        '--vscode-quickInputList-focusForeground': styles.getPropertyValue('--vscode-quickInputList-focusForeground'),
                        '--vscode-quickInputList-focusIconForeground': styles.getPropertyValue('--vscode-quickInputList-focusIconForeground'),
                        '--vscode-quickInputList-focusBackground': styles.getPropertyValue('--vscode-quickInputList-focusBackground'),

                        // Search
                        '--vscode-search-resultsInfoForeground': styles.getPropertyValue('--vscode-search-resultsInfoForeground'),
                        '--vscode-searchEditor-findMatchBackground': styles.getPropertyValue('--vscode-searchEditor-findMatchBackground'),
                        '--vscode-searchEditor-textInputBorder': styles.getPropertyValue('--vscode-searchEditor-textInputBorder'),

                        // Editor cursor and line numbers
                        '--vscode-editorCursor-foreground': styles.getPropertyValue('--vscode-editorCursor-foreground'),
                        '--vscode-editorMultiCursor-primary.foreground': styles.getPropertyValue('--vscode-editorMultiCursor-primary.foreground'),
                        '--vscode-editorMultiCursor-secondary.foreground': styles.getPropertyValue('--vscode-editorMultiCursor-secondary.foreground'),
                        '--vscode-editorWhitespace-foreground': styles.getPropertyValue('--vscode-editorWhitespace-foreground'),
                        '--vscode-editorLineNumber-foreground': styles.getPropertyValue('--vscode-editorLineNumber-foreground'),
                        '--vscode-editorActiveLineNumber-foreground': styles.getPropertyValue('--vscode-editorActiveLineNumber-foreground'),
                        '--vscode-editorLineNumber-activeForeground': styles.getPropertyValue('--vscode-editorLineNumber-activeForeground'),

                        // Editor indent guides
                        '--vscode-editorIndentGuide-background': styles.getPropertyValue('--vscode-editorIndentGuide-background'),
                        '--vscode-editorIndentGuide-activeBackground': styles.getPropertyValue('--vscode-editorIndentGuide-activeBackground'),
                        '--vscode-editorIndentGuide-background1': styles.getPropertyValue('--vscode-editorIndentGuide-background1'),
                        '--vscode-editorIndentGuide-background2': styles.getPropertyValue('--vscode-editorIndentGuide-background2'),
                        '--vscode-editorIndentGuide-background3': styles.getPropertyValue('--vscode-editorIndentGuide-background3'),
                        '--vscode-editorIndentGuide-background4': styles.getPropertyValue('--vscode-editorIndentGuide-background4'),
                        '--vscode-editorIndentGuide-background5': styles.getPropertyValue('--vscode-editorIndentGuide-background5'),
                        '--vscode-editorIndentGuide-background6': styles.getPropertyValue('--vscode-editorIndentGuide-background6'),
                        '--vscode-editorIndentGuide-activeBackground1': styles.getPropertyValue('--vscode-editorIndentGuide-activeBackground1'),
                        '--vscode-editorIndentGuide-activeBackground2': styles.getPropertyValue('--vscode-editorIndentGuide-activeBackground2'),
                        '--vscode-editorIndentGuide-activeBackground3': styles.getPropertyValue('--vscode-editorIndentGuide-activeBackground3'),
                        '--vscode-editorIndentGuide-activeBackground4': styles.getPropertyValue('--vscode-editorIndentGuide-activeBackground4'),
                        '--vscode-editorIndentGuide-activeBackground5': styles.getPropertyValue('--vscode-editorIndentGuide-activeBackground5'),
                        '--vscode-editorIndentGuide-activeBackground6': styles.getPropertyValue('--vscode-editorIndentGuide-activeBackground6'),

                        // Editor ruler and code lens
                        '--vscode-editorRuler-foreground': styles.getPropertyValue('--vscode-editorRuler-foreground'),
                        '--vscode-editorCodeLens-foreground': styles.getPropertyValue('--vscode-editorCodeLens-foreground'),

                        // Editor brackets
                        '--vscode-editorBracketMatch-background': styles.getPropertyValue('--vscode-editorBracketMatch-background'),
                        '--vscode-editorBracketMatch-border': styles.getPropertyValue('--vscode-editorBracketMatch-border'),
                        '--vscode-editorBracketHighlight-foreground1': styles.getPropertyValue('--vscode-editorBracketHighlight-foreground1'),
                        '--vscode-editorBracketHighlight-foreground2': styles.getPropertyValue('--vscode-editorBracketHighlight-foreground2'),
                        '--vscode-editorBracketHighlight-foreground3': styles.getPropertyValue('--vscode-editorBracketHighlight-foreground3'),
                        '--vscode-editorBracketHighlight-foreground4': styles.getPropertyValue('--vscode-editorBracketHighlight-foreground4'),
                        '--vscode-editorBracketHighlight-foreground5': styles.getPropertyValue('--vscode-editorBracketHighlight-foreground5'),
                        '--vscode-editorBracketHighlight-foreground6': styles.getPropertyValue('--vscode-editorBracketHighlight-foreground6'),
                        '--vscode-editorBracketHighlight-unexpectedBracket.foreground': styles.getPropertyValue('--vscode-editorBracketHighlight-unexpectedBracket.foreground'),
                        '--vscode-editorBracketPairGuide-background1': styles.getPropertyValue('--vscode-editorBracketPairGuide-background1'),
                        '--vscode-editorBracketPairGuide-background2': styles.getPropertyValue('--vscode-editorBracketPairGuide-background2'),
                        '--vscode-editorBracketPairGuide-background3': styles.getPropertyValue('--vscode-editorBracketPairGuide-background3'),
                        '--vscode-editorBracketPairGuide-background4': styles.getPropertyValue('--vscode-editorBracketPairGuide-background4'),
                        '--vscode-editorBracketPairGuide-background5': styles.getPropertyValue('--vscode-editorBracketPairGuide-background5'),
                        '--vscode-editorBracketPairGuide-background6': styles.getPropertyValue('--vscode-editorBracketPairGuide-background6'),
                        '--vscode-editorBracketPairGuide-activeBackground1': styles.getPropertyValue('--vscode-editorBracketPairGuide-activeBackground1'),
                        '--vscode-editorBracketPairGuide-activeBackground2': styles.getPropertyValue('--vscode-editorBracketPairGuide-activeBackground2'),
                        '--vscode-editorBracketPairGuide-activeBackground3': styles.getPropertyValue('--vscode-editorBracketPairGuide-activeBackground3'),
                        '--vscode-editorBracketPairGuide-activeBackground4': styles.getPropertyValue('--vscode-editorBracketPairGuide-activeBackground4'),
                        '--vscode-editorBracketPairGuide-activeBackground5': styles.getPropertyValue('--vscode-editorBracketPairGuide-activeBackground5'),
                        '--vscode-editorBracketPairGuide-activeBackground6': styles.getPropertyValue('--vscode-editorBracketPairGuide-activeBackground6'),

                        // Editor gutter
                        '--vscode-editorGutter-background': styles.getPropertyValue('--vscode-editorGutter-background'),
                        '--vscode-editorGutter-modifiedBackground': styles.getPropertyValue('--vscode-editorGutter-modifiedBackground'),
                        '--vscode-editorGutter-addedBackground': styles.getPropertyValue('--vscode-editorGutter-addedBackground'),
                        '--vscode-editorGutter-deletedBackground': styles.getPropertyValue('--vscode-editorGutter-deletedBackground'),
                        '--vscode-editorGutter-foldingControlForeground': styles.getPropertyValue('--vscode-editorGutter-foldingControlForeground'),
                        '--vscode-editorGutter-itemGlyphForeground': styles.getPropertyValue('--vscode-editorGutter-itemGlyphForeground'),
                        '--vscode-editorGutter-itemBackground': styles.getPropertyValue('--vscode-editorGutter-itemBackground'),
                        '--vscode-editorGutter-commentRangeForeground': styles.getPropertyValue('--vscode-editorGutter-commentRangeForeground'),
                        '--vscode-editorGutter-commentGlyphForeground': styles.getPropertyValue('--vscode-editorGutter-commentGlyphForeground'),
                        '--vscode-editorGutter-commentUnresolvedGlyphForeground': styles.getPropertyValue('--vscode-editorGutter-commentUnresolvedGlyphForeground'),

                        // Editor unnecessary code
                        '--vscode-editorUnnecessaryCode-opacity': styles.getPropertyValue('--vscode-editorUnnecessaryCode-opacity'),
                        '--vscode-editorGhostText-foreground': styles.getPropertyValue('--vscode-editorGhostText-foreground'),

                        // Editor unicode highlight
                        '--vscode-editorUnicodeHighlight-border': styles.getPropertyValue('--vscode-editorUnicodeHighlight-border'),

                        // Action bar
                        '--vscode-actionBar-toggledBackground': styles.getPropertyValue('--vscode-actionBar-toggledBackground'),

                        // Symbol icons
                        '--vscode-symbolIcon-arrayForeground': styles.getPropertyValue('--vscode-symbolIcon-arrayForeground'),
                        '--vscode-symbolIcon-booleanForeground': styles.getPropertyValue('--vscode-symbolIcon-booleanForeground'),
                        '--vscode-symbolIcon-classForeground': styles.getPropertyValue('--vscode-symbolIcon-classForeground'),
                        '--vscode-symbolIcon-colorForeground': styles.getPropertyValue('--vscode-symbolIcon-colorForeground'),
                        '--vscode-symbolIcon-constantForeground': styles.getPropertyValue('--vscode-symbolIcon-constantForeground'),
                        '--vscode-symbolIcon-constructorForeground': styles.getPropertyValue('--vscode-symbolIcon-constructorForeground'),
                        '--vscode-symbolIcon-enumeratorForeground': styles.getPropertyValue('--vscode-symbolIcon-enumeratorForeground'),
                        '--vscode-symbolIcon-enumeratorMemberForeground': styles.getPropertyValue('--vscode-symbolIcon-enumeratorMemberForeground'),
                        '--vscode-symbolIcon-eventForeground': styles.getPropertyValue('--vscode-symbolIcon-eventForeground'),
                        '--vscode-symbolIcon-fieldForeground': styles.getPropertyValue('--vscode-symbolIcon-fieldForeground'),
                        '--vscode-symbolIcon-fileForeground': styles.getPropertyValue('--vscode-symbolIcon-fileForeground'),
                        '--vscode-symbolIcon-folderForeground': styles.getPropertyValue('--vscode-symbolIcon-folderForeground'),
                        '--vscode-symbolIcon-functionForeground': styles.getPropertyValue('--vscode-symbolIcon-functionForeground'),
                        '--vscode-symbolIcon-interfaceForeground': styles.getPropertyValue('--vscode-symbolIcon-interfaceForeground'),
                        '--vscode-symbolIcon-keyForeground': styles.getPropertyValue('--vscode-symbolIcon-keyForeground'),
                        '--vscode-symbolIcon-keywordForeground': styles.getPropertyValue('--vscode-symbolIcon-keywordForeground'),
                        '--vscode-symbolIcon-methodForeground': styles.getPropertyValue('--vscode-symbolIcon-methodForeground'),
                        '--vscode-symbolIcon-moduleForeground': styles.getPropertyValue('--vscode-symbolIcon-moduleForeground'),
                        '--vscode-symbolIcon-namespaceForeground': styles.getPropertyValue('--vscode-symbolIcon-namespaceForeground'),
                        '--vscode-symbolIcon-nullForeground': styles.getPropertyValue('--vscode-symbolIcon-nullForeground'),
                        '--vscode-symbolIcon-numberForeground': styles.getPropertyValue('--vscode-symbolIcon-numberForeground'),
                        '--vscode-symbolIcon-objectForeground': styles.getPropertyValue('--vscode-symbolIcon-objectForeground'),
                        '--vscode-symbolIcon-operatorForeground': styles.getPropertyValue('--vscode-symbolIcon-operatorForeground'),
                        '--vscode-symbolIcon-packageForeground': styles.getPropertyValue('--vscode-symbolIcon-packageForeground'),
                        '--vscode-symbolIcon-propertyForeground': styles.getPropertyValue('--vscode-symbolIcon-propertyForeground'),
                        '--vscode-symbolIcon-referenceForeground': styles.getPropertyValue('--vscode-symbolIcon-referenceForeground'),
                        '--vscode-symbolIcon-snippetForeground': styles.getPropertyValue('--vscode-symbolIcon-snippetForeground'),
                        '--vscode-symbolIcon-stringForeground': styles.getPropertyValue('--vscode-symbolIcon-stringForeground'),
                        '--vscode-symbolIcon-structForeground': styles.getPropertyValue('--vscode-symbolIcon-structForeground'),
                        '--vscode-symbolIcon-textForeground': styles.getPropertyValue('--vscode-symbolIcon-textForeground'),
                        '--vscode-symbolIcon-typeParameterForeground': styles.getPropertyValue('--vscode-symbolIcon-typeParameterForeground'),
                        '--vscode-symbolIcon-unitForeground': styles.getPropertyValue('--vscode-symbolIcon-unitForeground'),
                        '--vscode-symbolIcon-variableForeground': styles.getPropertyValue('--vscode-symbolIcon-variableForeground'),

                        // Peek view
                        '--vscode-peekViewTitle-background': styles.getPropertyValue('--vscode-peekViewTitle-background'),
                        '--vscode-peekViewTitleLabel-foreground': styles.getPropertyValue('--vscode-peekViewTitleLabel-foreground'),
                        '--vscode-peekViewTitleDescription-foreground': styles.getPropertyValue('--vscode-peekViewTitleDescription-foreground'),
                        '--vscode-peekView-border': styles.getPropertyValue('--vscode-peekView-border'),
                        '--vscode-peekViewResult-background': styles.getPropertyValue('--vscode-peekViewResult-background'),
                        '--vscode-peekViewResult-lineForeground': styles.getPropertyValue('--vscode-peekViewResult-lineForeground'),
                        '--vscode-peekViewResult-fileForeground': styles.getPropertyValue('--vscode-peekViewResult-fileForeground'),
                        '--vscode-peekViewResult-selectionBackground': styles.getPropertyValue('--vscode-peekViewResult-selectionBackground'),
                        '--vscode-peekViewResult-selectionForeground': styles.getPropertyValue('--vscode-peekViewResult-selectionForeground'),
                        '--vscode-peekViewEditor-background': styles.getPropertyValue('--vscode-peekViewEditor-background'),
                        '--vscode-peekViewEditorGutter-background': styles.getPropertyValue('--vscode-peekViewEditorGutter-background'),
                        '--vscode-peekViewEditorStickyScroll-background': styles.getPropertyValue('--vscode-peekViewEditorStickyScroll-background'),
                        '--vscode-peekViewResult-matchHighlightBackground': styles.getPropertyValue('--vscode-peekViewResult-matchHighlightBackground'),
                        '--vscode-peekViewEditor-matchHighlightBackground': styles.getPropertyValue('--vscode-peekViewEditor-matchHighlightBackground'),

                        // Editor fold
                        '--vscode-editor-foldBackground': styles.getPropertyValue('--vscode-editor-foldBackground'),
                        '--vscode-editor-foldPlaceholderForeground': styles.getPropertyValue('--vscode-editor-foldPlaceholderForeground'),

                        // Editor suggest widget
                        '--vscode-editorSuggestWidget-background': styles.getPropertyValue('--vscode-editorSuggestWidget-background'),
                        '--vscode-editorSuggestWidget-border': styles.getPropertyValue('--vscode-editorSuggestWidget-border'),
                        '--vscode-editorSuggestWidget-foreground': styles.getPropertyValue('--vscode-editorSuggestWidget-foreground'),
                        '--vscode-editorSuggestWidget-selectedForeground': styles.getPropertyValue('--vscode-editorSuggestWidget-selectedForeground'),
                        '--vscode-editorSuggestWidget-selectedIconForeground': styles.getPropertyValue('--vscode-editorSuggestWidget-selectedIconForeground'),
                        '--vscode-editorSuggestWidget-selectedBackground': styles.getPropertyValue('--vscode-editorSuggestWidget-selectedBackground'),
                        '--vscode-editorSuggestWidget-highlightForeground': styles.getPropertyValue('--vscode-editorSuggestWidget-highlightForeground'),
                        '--vscode-editorSuggestWidget-focusHighlightForeground': styles.getPropertyValue('--vscode-editorSuggestWidget-focusHighlightForeground'),
                        '--vscode-editorSuggestWidgetStatus-foreground': styles.getPropertyValue('--vscode-editorSuggestWidgetStatus-foreground'),

                        // Inline edit
                        '--vscode-inlineEdit-originalBackground': styles.getPropertyValue('--vscode-inlineEdit-originalBackground'),
                        '--vscode-inlineEdit-modifiedBackground': styles.getPropertyValue('--vscode-inlineEdit-modifiedBackground'),
                        '--vscode-inlineEdit-originalChangedLineBackground': styles.getPropertyValue('--vscode-inlineEdit-originalChangedLineBackground'),
                        '--vscode-inlineEdit-originalChangedTextBackground': styles.getPropertyValue('--vscode-inlineEdit-originalChangedTextBackground'),
                        '--vscode-inlineEdit-modifiedChangedLineBackground': styles.getPropertyValue('--vscode-inlineEdit-modifiedChangedLineBackground'),
                        '--vscode-inlineEdit-modifiedChangedTextBackground': styles.getPropertyValue('--vscode-inlineEdit-modifiedChangedTextBackground'),
                        '--vscode-inlineEdit-gutterIndicator.primaryForeground': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.primaryForeground'),
                        '--vscode-inlineEdit-gutterIndicator.primaryBorder': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.primaryBorder'),
                        '--vscode-inlineEdit-gutterIndicator.primaryBackground': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.primaryBackground'),
                        '--vscode-inlineEdit-gutterIndicator.secondaryForeground': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.secondaryForeground'),
                        '--vscode-inlineEdit-gutterIndicator.secondaryBorder': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.secondaryBorder'),
                        '--vscode-inlineEdit-gutterIndicator.secondaryBackground': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.secondaryBackground'),
                        '--vscode-inlineEdit-gutterIndicator.successfulForeground': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.successfulForeground'),
                        '--vscode-inlineEdit-gutterIndicator.successfulBorder': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.successfulBorder'),
                        '--vscode-inlineEdit-gutterIndicator.successfulBackground': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.successfulBackground'),
                        '--vscode-inlineEdit-gutterIndicator.background': styles.getPropertyValue('--vscode-inlineEdit-gutterIndicator.background'),
                        '--vscode-inlineEdit-originalBorder': styles.getPropertyValue('--vscode-inlineEdit-originalBorder'),
                        '--vscode-inlineEdit-modifiedBorder': styles.getPropertyValue('--vscode-inlineEdit-modifiedBorder'),
                        '--vscode-inlineEdit-tabWillAcceptModifiedBorder': styles.getPropertyValue('--vscode-inlineEdit-tabWillAcceptModifiedBorder'),
                        '--vscode-inlineEdit-tabWillAcceptOriginalBorder': styles.getPropertyValue('--vscode-inlineEdit-tabWillAcceptOriginalBorder'),

                        // Tab
                        '--vscode-tab-activeBackground': styles.getPropertyValue('--vscode-tab-activeBackground'),
                        '--vscode-tab-unfocusedActiveBackground': styles.getPropertyValue('--vscode-tab-unfocusedActiveBackground'),
                        '--vscode-tab-inactiveBackground': styles.getPropertyValue('--vscode-tab-inactiveBackground'),
                        '--vscode-tab-unfocusedInactiveBackground': styles.getPropertyValue('--vscode-tab-unfocusedInactiveBackground'),
                        '--vscode-tab-activeForeground': styles.getPropertyValue('--vscode-tab-activeForeground'),
                        '--vscode-tab-inactiveForeground': styles.getPropertyValue('--vscode-tab-inactiveForeground'),
                        '--vscode-tab-unfocusedActiveForeground': styles.getPropertyValue('--vscode-tab-unfocusedActiveForeground'),
                        '--vscode-tab-unfocusedInactiveForeground': styles.getPropertyValue('--vscode-tab-unfocusedInactiveForeground'),
                        '--vscode-tab-hoverBackground': styles.getPropertyValue('--vscode-tab-hoverBackground'),
                        '--vscode-tab-unfocusedHoverBackground': styles.getPropertyValue('--vscode-tab-unfocusedHoverBackground'),
                        '--vscode-tab-border': styles.getPropertyValue('--vscode-tab-border'),
                        '--vscode-tab-lastPinnedBorder': styles.getPropertyValue('--vscode-tab-lastPinnedBorder'),
                        '--vscode-tab-activeBorder': styles.getPropertyValue('--vscode-tab-activeBorder'),
                        '--vscode-tab-unfocusedActiveBorder': styles.getPropertyValue('--vscode-tab-unfocusedActiveBorder'),
                        '--vscode-tab-activeBorderTop': styles.getPropertyValue('--vscode-tab-activeBorderTop'),
                        '--vscode-tab-unfocusedActiveBorderTop': styles.getPropertyValue('--vscode-tab-unfocusedActiveBorderTop'),
                        '--vscode-tab-selectedBorderTop': styles.getPropertyValue('--vscode-tab-selectedBorderTop'),
                        '--vscode-tab-selectedBackground': styles.getPropertyValue('--vscode-tab-selectedBackground'),
                        '--vscode-tab-selectedForeground': styles.getPropertyValue('--vscode-tab-selectedForeground'),
                        '--vscode-tab-dragAndDropBorder': styles.getPropertyValue('--vscode-tab-dragAndDropBorder'),
                        '--vscode-tab-activeModifiedBorder': styles.getPropertyValue('--vscode-tab-activeModifiedBorder'),
                        '--vscode-tab-inactiveModifiedBorder': styles.getPropertyValue('--vscode-tab-inactiveModifiedBorder'),
                        '--vscode-tab-unfocusedActiveModifiedBorder': styles.getPropertyValue('--vscode-tab-unfocusedActiveModifiedBorder'),
                        '--vscode-tab-unfocusedInactiveModifiedBorder': styles.getPropertyValue('--vscode-tab-unfocusedInactiveModifiedBorder'),

                        // Editor pane and group
                        '--vscode-editorPane-background': styles.getPropertyValue('--vscode-editorPane-background'),
                        '--vscode-editorGroupHeader-tabsBackground': styles.getPropertyValue('--vscode-editorGroupHeader-tabsBackground'),
                        '--vscode-editorGroupHeader-tabsBorder': styles.getPropertyValue('--vscode-editorGroupHeader-tabsBorder'),
                        '--vscode-editorGroupHeader-noTabsBackground': styles.getPropertyValue('--vscode-editorGroupHeader-noTabsBackground'),
                        '--vscode-editorGroup-border': styles.getPropertyValue('--vscode-editorGroup-border'),
                        '--vscode-editorGroup-dropBackground': styles.getPropertyValue('--vscode-editorGroup-dropBackground'),
                        '--vscode-editorGroup-dropIntoPromptForeground': styles.getPropertyValue('--vscode-editorGroup-dropIntoPromptForeground'),
                        '--vscode-editorGroup-dropIntoPromptBackground': styles.getPropertyValue('--vscode-editorGroup-dropIntoPromptBackground'),
                        '--vscode-sideBySideEditor-horizontalBorder': styles.getPropertyValue('--vscode-sideBySideEditor-horizontalBorder'),
                        '--vscode-sideBySideEditor-verticalBorder': styles.getPropertyValue('--vscode-sideBySideEditor-verticalBorder'),

                        // Banner
                        '--vscode-banner-background': styles.getPropertyValue('--vscode-banner-background'),
                        '--vscode-banner-foreground': styles.getPropertyValue('--vscode-banner-foreground'),
                        '--vscode-banner-iconForeground': styles.getPropertyValue('--vscode-banner-iconForeground'),

                        // Status bar
                        '--vscode-statusBar-foreground': styles.getPropertyValue('--vscode-statusBar-foreground'),
                        '--vscode-statusBar-noFolderForeground': styles.getPropertyValue('--vscode-statusBar-noFolderForeground'),
                        '--vscode-statusBar-background': styles.getPropertyValue('--vscode-statusBar-background'),
                        '--vscode-statusBar-noFolderBackground': styles.getPropertyValue('--vscode-statusBar-noFolderBackground'),
                        '--vscode-statusBar-border': styles.getPropertyValue('--vscode-statusBar-border'),
                        '--vscode-statusBar-focusBorder': styles.getPropertyValue('--vscode-statusBar-focusBorder'),
                        '--vscode-statusBar-noFolderBorder': styles.getPropertyValue('--vscode-statusBar-noFolderBorder'),
                        '--vscode-statusBar-debuggingBackground': styles.getPropertyValue('--vscode-statusBar-debuggingBackground'),
                        '--vscode-statusBar-debuggingForeground': styles.getPropertyValue('--vscode-statusBar-debuggingForeground'),
                        '--vscode-statusBar-debuggingBorder': styles.getPropertyValue('--vscode-statusBar-debuggingBorder'),
                        '--vscode-statusBarItem-activeBackground': styles.getPropertyValue('--vscode-statusBarItem-activeBackground'),
                        '--vscode-statusBarItem-focusBorder': styles.getPropertyValue('--vscode-statusBarItem-focusBorder'),
                        '--vscode-statusBarItem-hoverBackground': styles.getPropertyValue('--vscode-statusBarItem-hoverBackground'),
                        '--vscode-statusBarItem-hoverForeground': styles.getPropertyValue('--vscode-statusBarItem-hoverForeground'),
                        '--vscode-statusBarItem-compactHoverBackground': styles.getPropertyValue('--vscode-statusBarItem-compactHoverBackground'),
                        '--vscode-statusBarItem-prominentForeground': styles.getPropertyValue('--vscode-statusBarItem-prominentForeground'),
                        '--vscode-statusBarItem-prominentBackground': styles.getPropertyValue('--vscode-statusBarItem-prominentBackground'),
                        '--vscode-statusBarItem-prominentHoverForeground': styles.getPropertyValue('--vscode-statusBarItem-prominentHoverForeground'),
                        '--vscode-statusBarItem-prominentHoverBackground': styles.getPropertyValue('--vscode-statusBarItem-prominentHoverBackground'),
                        '--vscode-statusBarItem-errorBackground': styles.getPropertyValue('--vscode-statusBarItem-errorBackground'),
                        '--vscode-statusBarItem-errorForeground': styles.getPropertyValue('--vscode-statusBarItem-errorForeground'),
                        '--vscode-statusBarItem-errorHoverForeground': styles.getPropertyValue('--vscode-statusBarItem-errorHoverForeground'),
                        '--vscode-statusBarItem-errorHoverBackground': styles.getPropertyValue('--vscode-statusBarItem-errorHoverBackground'),
                        '--vscode-statusBarItem-warningBackground': styles.getPropertyValue('--vscode-statusBarItem-warningBackground'),
                        '--vscode-statusBarItem-warningForeground': styles.getPropertyValue('--vscode-statusBarItem-warningForeground'),
                        '--vscode-statusBarItem-warningHoverForeground': styles.getPropertyValue('--vscode-statusBarItem-warningHoverForeground'),
                        '--vscode-statusBarItem-warningHoverBackground': styles.getPropertyValue('--vscode-statusBarItem-warningHoverBackground'),
                        '--vscode-statusBarItem-remoteBackground': styles.getPropertyValue('--vscode-statusBarItem-remoteBackground'),
                        '--vscode-statusBarItem-remoteForeground': styles.getPropertyValue('--vscode-statusBarItem-remoteForeground'),
                        '--vscode-statusBarItem-remoteHoverForeground': styles.getPropertyValue('--vscode-statusBarItem-remoteHoverForeground'),
                        '--vscode-statusBarItem-remoteHoverBackground': styles.getPropertyValue('--vscode-statusBarItem-remoteHoverBackground'),
                        '--vscode-statusBarItem-offlineBackground': styles.getPropertyValue('--vscode-statusBarItem-offlineBackground'),
                        '--vscode-statusBarItem-offlineForeground': styles.getPropertyValue('--vscode-statusBarItem-offlineForeground'),
                        '--vscode-statusBarItem-offlineHoverForeground': styles.getPropertyValue('--vscode-statusBarItem-offlineHoverForeground'),
                        '--vscode-statusBarItem-offlineHoverBackground': styles.getPropertyValue('--vscode-statusBarItem-offlineHoverBackground'),

                        // Activity bar
                        '--vscode-activityBar-background': styles.getPropertyValue('--vscode-activityBar-background'),
                        '--vscode-activityBar-foreground': styles.getPropertyValue('--vscode-activityBar-foreground'),
                        '--vscode-activityBar-inactiveForeground': styles.getPropertyValue('--vscode-activityBar-inactiveForeground'),
                        '--vscode-activityBar-border': styles.getPropertyValue('--vscode-activityBar-border'),
                        '--vscode-activityBar-activeBorder': styles.getPropertyValue('--vscode-activityBar-activeBorder'),
                        '--vscode-activityBar-dropBorder': styles.getPropertyValue('--vscode-activityBar-dropBorder'),
                        '--vscode-activityBarBadge-background': styles.getPropertyValue('--vscode-activityBarBadge-background'),
                        '--vscode-activityBarBadge-foreground': styles.getPropertyValue('--vscode-activityBarBadge-foreground'),
                        '--vscode-activityBarTop-foreground': styles.getPropertyValue('--vscode-activityBarTop-foreground'),
                        '--vscode-activityBarTop-activeBorder': styles.getPropertyValue('--vscode-activityBarTop-activeBorder'),
                        '--vscode-activityBarTop-inactiveForeground': styles.getPropertyValue('--vscode-activityBarTop-inactiveForeground'),
                        '--vscode-activityBarTop-dropBorder': styles.getPropertyValue('--vscode-activityBarTop-dropBorder'),

                        // Panel
                        '--vscode-panel-background': styles.getPropertyValue('--vscode-panel-background'),
                        '--vscode-panel-border': styles.getPropertyValue('--vscode-panel-border'),
                        '--vscode-panel-foreground': styles.getPropertyValue('--vscode-panel-foreground'),
                        '--vscode-panelTitle-activeForeground': styles.getPropertyValue('--vscode-panelTitle-activeForeground'),
                        '--vscode-panelTitle-inactiveForeground': styles.getPropertyValue('--vscode-panelTitle-inactiveForeground'),
                        '--vscode-panelTitle-activeBorder': styles.getPropertyValue('--vscode-panelTitle-activeBorder'),
                        '--vscode-panelTitleBadge-background': styles.getPropertyValue('--vscode-panelTitleBadge-background'),
                        '--vscode-panelTitleBadge-foreground': styles.getPropertyValue('--vscode-panelTitleBadge-foreground'),
                        '--vscode-panelInput-border': styles.getPropertyValue('--vscode-panelInput-border'),
                        '--vscode-panel-dropBorder': styles.getPropertyValue('--vscode-panel-dropBorder'),
                        '--vscode-panelSection-dropBackground': styles.getPropertyValue('--vscode-panelSection-dropBackground'),
                        '--vscode-panelSectionHeader-background': styles.getPropertyValue('--vscode-panelSectionHeader-background'),
                        '--vscode-panelSection-border': styles.getPropertyValue('--vscode-panelSection-border'),
                        '--vscode-panelStickyScroll-background': styles.getPropertyValue('--vscode-panelStickyScroll-background'),
                        '--vscode-panelStickyScroll-shadow': styles.getPropertyValue('--vscode-panelStickyScroll-shadow'),

                        // Profile badge
                        '--vscode-profileBadge-background': styles.getPropertyValue('--vscode-profileBadge-background'),
                        '--vscode-profileBadge-foreground': styles.getPropertyValue('--vscode-profileBadge-foreground'),

                        // Extension badge
                        '--vscode-extensionBadge-remoteBackground': styles.getPropertyValue('--vscode-extensionBadge-remoteBackground'),
                        '--vscode-extensionBadge-remoteForeground': styles.getPropertyValue('--vscode-extensionBadge-remoteForeground'),

                        // Sidebar
                        '--vscode-sideBar-background': styles.getPropertyValue('--vscode-sideBar-background'),
                        '--vscode-sideBar-foreground': styles.getPropertyValue('--vscode-sideBar-foreground'),
                        '--vscode-sideBar-border': styles.getPropertyValue('--vscode-sideBar-border'),
                        '--vscode-sideBarTitle-background': styles.getPropertyValue('--vscode-sideBarTitle-background'),
                        '--vscode-sideBarTitle-foreground': styles.getPropertyValue('--vscode-sideBarTitle-foreground'),
                        '--vscode-sideBar-dropBackground': styles.getPropertyValue('--vscode-sideBar-dropBackground'),
                        '--vscode-sideBarSectionHeader-background': styles.getPropertyValue('--vscode-sideBarSectionHeader-background'),
                        '--vscode-sideBarSectionHeader-foreground': styles.getPropertyValue('--vscode-sideBarSectionHeader-foreground'),
                        '--vscode-sideBarSectionHeader-border': styles.getPropertyValue('--vscode-sideBarSectionHeader-border'),
                        '--vscode-sideBarActivityBarTop-border': styles.getPropertyValue('--vscode-sideBarActivityBarTop-border'),
                        '--vscode-sideBarStickyScroll-background': styles.getPropertyValue('--vscode-sideBarStickyScroll-background'),
                        '--vscode-sideBarStickyScroll-shadow': styles.getPropertyValue('--vscode-sideBarStickyScroll-shadow'),

                        // Title bar
                        '--vscode-titleBar-activeForeground': styles.getPropertyValue('--vscode-titleBar-activeForeground'),
                        '--vscode-titleBar-inactiveForeground': styles.getPropertyValue('--vscode-titleBar-inactiveForeground'),
                        '--vscode-titleBar-activeBackground': styles.getPropertyValue('--vscode-titleBar-activeBackground'),
                        '--vscode-titleBar-inactiveBackground': styles.getPropertyValue('--vscode-titleBar-inactiveBackground'),
                        '--vscode-titleBar-border': styles.getPropertyValue('--vscode-titleBar-border'),

                        // Menu bar
                        '--vscode-menubar-selectionForeground': styles.getPropertyValue('--vscode-menubar-selectionForeground'),
                        '--vscode-menubar-selectionBackground': styles.getPropertyValue('--vscode-menubar-selectionBackground'),

                        // Command center
                        '--vscode-commandCenter-foreground': styles.getPropertyValue('--vscode-commandCenter-foreground'),
                        '--vscode-commandCenter-activeForeground': styles.getPropertyValue('--vscode-commandCenter-activeForeground'),
                        '--vscode-commandCenter-inactiveForeground': styles.getPropertyValue('--vscode-commandCenter-inactiveForeground'),
                        '--vscode-commandCenter-background': styles.getPropertyValue('--vscode-commandCenter-background'),
                        '--vscode-commandCenter-activeBackground': styles.getPropertyValue('--vscode-commandCenter-activeBackground'),
                        '--vscode-commandCenter-border': styles.getPropertyValue('--vscode-commandCenter-border'),
                        '--vscode-commandCenter-activeBorder': styles.getPropertyValue('--vscode-commandCenter-activeBorder'),
                        '--vscode-commandCenter-inactiveBorder': styles.getPropertyValue('--vscode-commandCenter-inactiveBorder'),
                        '--vscode-commandCenter-debuggingBackground': styles.getPropertyValue('--vscode-commandCenter-debuggingBackground'),

                        // Notifications
                        '--vscode-notificationCenter-border': styles.getPropertyValue('--vscode-notificationCenter-border'),
                        '--vscode-notificationToast-border': styles.getPropertyValue('--vscode-notificationToast-border'),
                        '--vscode-notifications-foreground': styles.getPropertyValue('--vscode-notifications-foreground'),
                        '--vscode-notifications-background': styles.getPropertyValue('--vscode-notifications-background'),
                        '--vscode-notificationLink-foreground': styles.getPropertyValue('--vscode-notificationLink-foreground'),
                        '--vscode-notificationCenterHeader-foreground': styles.getPropertyValue('--vscode-notificationCenterHeader-foreground'),
                        '--vscode-notificationCenterHeader-background': styles.getPropertyValue('--vscode-notificationCenterHeader-background'),
                        '--vscode-notifications-border': styles.getPropertyValue('--vscode-notifications-border'),
                        '--vscode-notificationsErrorIcon-foreground': styles.getPropertyValue('--vscode-notificationsErrorIcon-foreground'),
                        '--vscode-notificationsWarningIcon-foreground': styles.getPropertyValue('--vscode-notificationsWarningIcon-foreground'),
                        '--vscode-notificationsInfoIcon-foreground': styles.getPropertyValue('--vscode-notificationsInfoIcon-foreground'),

                        // Debug
                        '--vscode-debugToolBar-background': styles.getPropertyValue('--vscode-debugToolBar-background'),
                        '--vscode-debugIcon-startForeground': styles.getPropertyValue('--vscode-debugIcon-startForeground'),
                        '--vscode-debugIcon-pauseForeground': styles.getPropertyValue('--vscode-debugIcon-pauseForeground'),
                        '--vscode-debugIcon-stopForeground': styles.getPropertyValue('--vscode-debugIcon-stopForeground'),
                        '--vscode-debugIcon-disconnectForeground': styles.getPropertyValue('--vscode-debugIcon-disconnectForeground'),
                        '--vscode-debugIcon-restartForeground': styles.getPropertyValue('--vscode-debugIcon-restartForeground'),
                        '--vscode-debugIcon-stepOverForeground': styles.getPropertyValue('--vscode-debugIcon-stepOverForeground'),
                        '--vscode-debugIcon-stepIntoForeground': styles.getPropertyValue('--vscode-debugIcon-stepIntoForeground'),
                        '--vscode-debugIcon-stepOutForeground': styles.getPropertyValue('--vscode-debugIcon-stepOutForeground'),
                        '--vscode-debugIcon-continueForeground': styles.getPropertyValue('--vscode-debugIcon-continueForeground'),
                        '--vscode-debugIcon-stepBackForeground': styles.getPropertyValue('--vscode-debugIcon-stepBackForeground'),
                        '--vscode-debugIcon-breakpointForeground': styles.getPropertyValue('--vscode-debugIcon-breakpointForeground'),
                        '--vscode-debugIcon-breakpointDisabledForeground': styles.getPropertyValue('--vscode-debugIcon-breakpointDisabledForeground'),
                        '--vscode-debugIcon-breakpointUnverifiedForeground': styles.getPropertyValue('--vscode-debugIcon-breakpointUnverifiedForeground'),
                        '--vscode-debugIcon-breakpointCurrentStackframeForeground': styles.getPropertyValue('--vscode-debugIcon-breakpointCurrentStackframeForeground'),
                        '--vscode-debugIcon-breakpointStackframeForeground': styles.getPropertyValue('--vscode-debugIcon-breakpointStackframeForeground'),
                        '--vscode-debugExceptionWidget-border': styles.getPropertyValue('--vscode-debugExceptionWidget-border'),
                        '--vscode-debugExceptionWidget-background': styles.getPropertyValue('--vscode-debugExceptionWidget-background'),
                        '--vscode-debugTokenExpression-name': styles.getPropertyValue('--vscode-debugTokenExpression-name'),
                        '--vscode-debugTokenExpression-type': styles.getPropertyValue('--vscode-debugTokenExpression-type'),
                        '--vscode-debugTokenExpression-value': styles.getPropertyValue('--vscode-debugTokenExpression-value'),
                        '--vscode-debugTokenExpression-string': styles.getPropertyValue('--vscode-debugTokenExpression-string'),
                        '--vscode-debugTokenExpression-boolean': styles.getPropertyValue('--vscode-debugTokenExpression-boolean'),
                        '--vscode-debugTokenExpression-number': styles.getPropertyValue('--vscode-debugTokenExpression-number'),
                        '--vscode-debugTokenExpression-error': styles.getPropertyValue('--vscode-debugTokenExpression-error'),
                        '--vscode-debugView-exceptionLabelForeground': styles.getPropertyValue('--vscode-debugView-exceptionLabelForeground'),
                        '--vscode-debugView-exceptionLabelBackground': styles.getPropertyValue('--vscode-debugView-exceptionLabelBackground'),
                        '--vscode-debugView-stateLabelForeground': styles.getPropertyValue('--vscode-debugView-stateLabelForeground'),
                        '--vscode-debugView-stateLabelBackground': styles.getPropertyValue('--vscode-debugView-stateLabelBackground'),
                        '--vscode-debugView-valueChangedHighlight': styles.getPropertyValue('--vscode-debugView-valueChangedHighlight'),
                        '--vscode-debugConsole-infoForeground': styles.getPropertyValue('--vscode-debugConsole-infoForeground'),
                        '--vscode-debugConsole-warningForeground': styles.getPropertyValue('--vscode-debugConsole-warningForeground'),
                        '--vscode-debugConsole-errorForeground': styles.getPropertyValue('--vscode-debugConsole-errorForeground'),
                        '--vscode-debugConsole-sourceForeground': styles.getPropertyValue('--vscode-debugConsole-sourceForeground'),
                        '--vscode-debugConsoleInputIcon-foreground': styles.getPropertyValue('--vscode-debugConsoleInputIcon-foreground'),

                        // Editor stack frame highlight
                        '--vscode-editor-stackFrameHighlightBackground': styles.getPropertyValue('--vscode-editor-stackFrameHighlightBackground'),
                        '--vscode-editor-focusedStackFrameHighlightBackground': styles.getPropertyValue('--vscode-editor-focusedStackFrameHighlightBackground'),

                        // Editor inline values
                        '--vscode-editor-inlineValuesForeground': styles.getPropertyValue('--vscode-editor-inlineValuesForeground'),
                        '--vscode-editor-inlineValuesBackground': styles.getPropertyValue('--vscode-editor-inlineValuesBackground'),

                        // Editor linked editing
                        '--vscode-editor-linkedEditingBackground': styles.getPropertyValue('--vscode-editor-linkedEditingBackground'),

                        // Editor placeholder
                        '--vscode-editor-placeholder.foreground': styles.getPropertyValue('--vscode-editor-placeholder.foreground'),

                        // Inline chat
                        '--vscode-inlineChat-foreground': styles.getPropertyValue('--vscode-inlineChat-foreground'),
                        '--vscode-inlineChat-background': styles.getPropertyValue('--vscode-inlineChat-background'),
                        '--vscode-inlineChat-border': styles.getPropertyValue('--vscode-inlineChat-border'),
                        '--vscode-inlineChat-shadow': styles.getPropertyValue('--vscode-inlineChat-shadow'),
                        '--vscode-inlineChatInput-border': styles.getPropertyValue('--vscode-inlineChatInput-border'),
                        '--vscode-inlineChatInput-focusBorder': styles.getPropertyValue('--vscode-inlineChatInput-focusBorder'),
                        '--vscode-inlineChatInput-placeholderForeground': styles.getPropertyValue('--vscode-inlineChatInput-placeholderForeground'),
                        '--vscode-inlineChatInput-background': styles.getPropertyValue('--vscode-inlineChatInput-background'),
                        '--vscode-inlineChatDiff-inserted': styles.getPropertyValue('--vscode-inlineChatDiff-inserted'),
                        '--vscode-inlineChatDiff-removed': styles.getPropertyValue('--vscode-inlineChatDiff-removed'),

                        // Extension button
                        '--vscode-extensionButton-background': styles.getPropertyValue('--vscode-extensionButton-background'),
                        '--vscode-extensionButton-foreground': styles.getPropertyValue('--vscode-extensionButton-foreground'),
                        '--vscode-extensionButton-hoverBackground': styles.getPropertyValue('--vscode-extensionButton-hoverBackground'),
                        '--vscode-extensionButton-separator': styles.getPropertyValue('--vscode-extensionButton-separator'),
                        '--vscode-extensionButton-prominentBackground': styles.getPropertyValue('--vscode-extensionButton-prominentBackground'),
                        '--vscode-extensionButton-prominentForeground': styles.getPropertyValue('--vscode-extensionButton-prominentForeground'),
                        '--vscode-extensionButton-prominentHoverBackground': styles.getPropertyValue('--vscode-extensionButton-prominentHoverBackground'),

                        // Extension icon
                        '--vscode-extensionIcon-verifiedForeground': styles.getPropertyValue('--vscode-extensionIcon-verifiedForeground'),
                        '--vscode-extensionIcon-starForeground': styles.getPropertyValue('--vscode-extensionIcon-starForeground'),
                        '--vscode-extensionIcon-preReleaseForeground': styles.getPropertyValue('--vscode-extensionIcon-preReleaseForeground'),
                        '--vscode-extensionIcon-sponsorForeground': styles.getPropertyValue('--vscode-extensionIcon-sponsorForeground'),
                        '--vscode-extensionIcon-privateForeground': styles.getPropertyValue('--vscode-extensionIcon-privateForeground'),

                        // Chat
                        '--vscode-chat-requestBorder': styles.getPropertyValue('--vscode-chat-requestBorder'),
                        '--vscode-chat-requestBackground': styles.getPropertyValue('--vscode-chat-requestBackground'),
                        '--vscode-chat-slashCommandBackground': styles.getPropertyValue('--vscode-chat-slashCommandBackground'),
                        '--vscode-chat-slashCommandForeground': styles.getPropertyValue('--vscode-chat-slashCommandForeground'),
                        '--vscode-chat-avatarBackground': styles.getPropertyValue('--vscode-chat-avatarBackground'),
                        '--vscode-chat-avatarForeground': styles.getPropertyValue('--vscode-chat-avatarForeground'),
                        '--vscode-chat-editedFileForeground': styles.getPropertyValue('--vscode-chat-editedFileForeground'),

                        // Comments view
                        '--vscode-commentsView-resolvedIcon': styles.getPropertyValue('--vscode-commentsView-resolvedIcon'),
                        '--vscode-commentsView-unresolvedIcon': styles.getPropertyValue('--vscode-commentsView-unresolvedIcon'),

                        // Editor comments widget
                        '--vscode-editorCommentsWidget-replyInputBackground': styles.getPropertyValue('--vscode-editorCommentsWidget-replyInputBackground'),
                        '--vscode-editorCommentsWidget-resolvedBorder': styles.getPropertyValue('--vscode-editorCommentsWidget-resolvedBorder'),
                        '--vscode-editorCommentsWidget-unresolvedBorder': styles.getPropertyValue('--vscode-editorCommentsWidget-unresolvedBorder'),
                        '--vscode-editorCommentsWidget-rangeBackground': styles.getPropertyValue('--vscode-editorCommentsWidget-rangeBackground'),
                        '--vscode-editorCommentsWidget-rangeActiveBackground': styles.getPropertyValue('--vscode-editorCommentsWidget-rangeActiveBackground'),

                        // Notebook
                        '--vscode-notebook-cellBorderColor': styles.getPropertyValue('--vscode-notebook-cellBorderColor'),
                        '--vscode-notebook-focusedEditorBorder': styles.getPropertyValue('--vscode-notebook-focusedEditorBorder'),
                        '--vscode-notebookStatusSuccessIcon-foreground': styles.getPropertyValue('--vscode-notebookStatusSuccessIcon-foreground'),
                        '--vscode-notebookEditorOverviewRuler-runningCellForeground': styles.getPropertyValue('--vscode-notebookEditorOverviewRuler-runningCellForeground'),
                        '--vscode-notebookStatusErrorIcon-foreground': styles.getPropertyValue('--vscode-notebookStatusErrorIcon-foreground'),
                        '--vscode-notebookStatusRunningIcon-foreground': styles.getPropertyValue('--vscode-notebookStatusRunningIcon-foreground'),
                        '--vscode-notebook-cellToolbarSeparator': styles.getPropertyValue('--vscode-notebook-cellToolbarSeparator'),
                        '--vscode-notebook-selectedCellBackground': styles.getPropertyValue('--vscode-notebook-selectedCellBackground'),
                        '--vscode-notebook-selectedCellBorder': styles.getPropertyValue('--vscode-notebook-selectedCellBorder'),
                        '--vscode-notebook-focusedCellBorder': styles.getPropertyValue('--vscode-notebook-focusedCellBorder'),
                        '--vscode-notebook-inactiveFocusedCellBorder': styles.getPropertyValue('--vscode-notebook-inactiveFocusedCellBorder'),
                        '--vscode-notebook-cellStatusBarItemHoverBackground': styles.getPropertyValue('--vscode-notebook-cellStatusBarItemHoverBackground'),
                        '--vscode-notebook-cellInsertionIndicator': styles.getPropertyValue('--vscode-notebook-cellInsertionIndicator'),
                        '--vscode-notebookScrollbarSlider-background': styles.getPropertyValue('--vscode-notebookScrollbarSlider-background'),
                        '--vscode-notebookScrollbarSlider-hoverBackground': styles.getPropertyValue('--vscode-notebookScrollbarSlider-hoverBackground'),
                        '--vscode-notebookScrollbarSlider-activeBackground': styles.getPropertyValue('--vscode-notebookScrollbarSlider-activeBackground'),
                        '--vscode-notebook-symbolHighlightBackground': styles.getPropertyValue('--vscode-notebook-symbolHighlightBackground'),
                        '--vscode-notebook-cellEditorBackground': styles.getPropertyValue('--vscode-notebook-cellEditorBackground'),
                        '--vscode-notebook-editorBackground': styles.getPropertyValue('--vscode-notebook-editorBackground'),

                        // Terminal
                        '--vscode-terminal-foreground': styles.getPropertyValue('--vscode-terminal-foreground'),
                        '--vscode-terminal-selectionBackground': styles.getPropertyValue('--vscode-terminal-selectionBackground'),
                        '--vscode-terminal-inactiveSelectionBackground': styles.getPropertyValue('--vscode-terminal-inactiveSelectionBackground'),
                        '--vscode-terminalCommandDecoration-defaultBackground': styles.getPropertyValue('--vscode-terminalCommandDecoration-defaultBackground'),
                        '--vscode-terminalCommandDecoration-successBackground': styles.getPropertyValue('--vscode-terminalCommandDecoration-successBackground'),
                        '--vscode-terminalCommandDecoration-errorBackground': styles.getPropertyValue('--vscode-terminalCommandDecoration-errorBackground'),
                        '--vscode-terminalOverviewRuler-cursorForeground': styles.getPropertyValue('--vscode-terminalOverviewRuler-cursorForeground'),
                        '--vscode-terminal-border': styles.getPropertyValue('--vscode-terminal-border'),
                        '--vscode-terminalOverviewRuler-border': styles.getPropertyValue('--vscode-terminalOverviewRuler-border'),
                        '--vscode-terminal-findMatchBackground': styles.getPropertyValue('--vscode-terminal-findMatchBackground'),
                        '--vscode-terminal-hoverHighlightBackground': styles.getPropertyValue('--vscode-terminal-hoverHighlightBackground'),
                        '--vscode-terminal-findMatchHighlightBackground': styles.getPropertyValue('--vscode-terminal-findMatchHighlightBackground'),
                        '--vscode-terminalOverviewRuler-findMatchForeground': styles.getPropertyValue('--vscode-terminalOverviewRuler-findMatchForeground'),
                        '--vscode-terminal-dropBackground': styles.getPropertyValue('--vscode-terminal-dropBackground'),
                        '--vscode-terminal-tab.activeBorder': styles.getPropertyValue('--vscode-terminal-tab.activeBorder'),
                        '--vscode-terminal-initialHintForeground': styles.getPropertyValue('--vscode-terminal-initialHintForeground'),
                        '--vscode-terminalStickyScrollHover-background': styles.getPropertyValue('--vscode-terminalStickyScrollHover-background'),
                        '--vscode-terminalCommandGuide-foreground': styles.getPropertyValue('--vscode-terminalCommandGuide-foreground'),

                        // Terminal ANSI colors
                        '--vscode-terminal-ansiBlack': styles.getPropertyValue('--vscode-terminal-ansiBlack'),
                        '--vscode-terminal-ansiRed': styles.getPropertyValue('--vscode-terminal-ansiRed'),
                        '--vscode-terminal-ansiGreen': styles.getPropertyValue('--vscode-terminal-ansiGreen'),
                        '--vscode-terminal-ansiYellow': styles.getPropertyValue('--vscode-terminal-ansiYellow'),
                        '--vscode-terminal-ansiBlue': styles.getPropertyValue('--vscode-terminal-ansiBlue'),
                        '--vscode-terminal-ansiMagenta': styles.getPropertyValue('--vscode-terminal-ansiMagenta'),
                        '--vscode-terminal-ansiCyan': styles.getPropertyValue('--vscode-terminal-ansiCyan'),
                        '--vscode-terminal-ansiWhite': styles.getPropertyValue('--vscode-terminal-ansiWhite'),
                        '--vscode-terminal-ansiBrightBlack': styles.getPropertyValue('--vscode-terminal-ansiBrightBlack'),
                        '--vscode-terminal-ansiBrightRed': styles.getPropertyValue('--vscode-terminal-ansiBrightRed'),
                        '--vscode-terminal-ansiBrightGreen': styles.getPropertyValue('--vscode-terminal-ansiBrightGreen'),
                        '--vscode-terminal-ansiBrightYellow': styles.getPropertyValue('--vscode-terminal-ansiBrightYellow'),
                        '--vscode-terminal-ansiBrightBlue': styles.getPropertyValue('--vscode-terminal-ansiBrightBlue'),
                        '--vscode-terminal-ansiBrightMagenta': styles.getPropertyValue('--vscode-terminal-ansiBrightMagenta'),
                        '--vscode-terminal-ansiBrightCyan': styles.getPropertyValue('--vscode-terminal-ansiBrightCyan'),
                        '--vscode-terminal-ansiBrightWhite': styles.getPropertyValue('--vscode-terminal-ansiBrightWhite'),

                        // Terminal symbol icons
                        '--vscode-terminalSymbolIcon-flagForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-flagForeground'),
                        '--vscode-terminalSymbolIcon-aliasForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-aliasForeground'),
                        '--vscode-terminalSymbolIcon-optionValueForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-optionValueForeground'),
                        '--vscode-terminalSymbolIcon-methodForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-methodForeground'),
                        '--vscode-terminalSymbolIcon-argumentForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-argumentForeground'),
                        '--vscode-terminalSymbolIcon-optionForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-optionForeground'),
                        '--vscode-terminalSymbolIcon-fileForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-fileForeground'),
                        '--vscode-terminalSymbolIcon-folderForeground': styles.getPropertyValue('--vscode-terminalSymbolIcon-folderForeground'),

                        // Editor marker navigation
                        '--vscode-editorMarkerNavigationError-background': styles.getPropertyValue('--vscode-editorMarkerNavigationError-background'),
                        '--vscode-editorMarkerNavigationError-headerBackground': styles.getPropertyValue('--vscode-editorMarkerNavigationError-headerBackground'),
                        '--vscode-editorMarkerNavigationWarning-background': styles.getPropertyValue('--vscode-editorMarkerNavigationWarning-background'),
                        '--vscode-editorMarkerNavigationWarning-headerBackground': styles.getPropertyValue('--vscode-editorMarkerNavigationWarning-headerBackground'),
                        '--vscode-editorMarkerNavigationInfo-background': styles.getPropertyValue('--vscode-editorMarkerNavigationInfo-background'),
                        '--vscode-editorMarkerNavigationInfo-headerBackground': styles.getPropertyValue('--vscode-editorMarkerNavigationInfo-headerBackground'),
                        '--vscode-editorMarkerNavigation-background': styles.getPropertyValue('--vscode-editorMarkerNavigation-background'),

                        // Merge editor
                        '--vscode-mergeEditor-change.background': styles.getPropertyValue('--vscode-mergeEditor-change.background'),
                        '--vscode-mergeEditor-change.word.background': styles.getPropertyValue('--vscode-mergeEditor-change.word.background'),
                        '--vscode-mergeEditor-changeBase.background': styles.getPropertyValue('--vscode-mergeEditor-changeBase.background'),
                        '--vscode-mergeEditor-changeBase.word.background': styles.getPropertyValue('--vscode-mergeEditor-changeBase.word.background'),
                        '--vscode-mergeEditor-conflict.unhandledUnfocused.border': styles.getPropertyValue('--vscode-mergeEditor-conflict.unhandledUnfocused.border'),
                        '--vscode-mergeEditor-conflict.unhandledFocused.border': styles.getPropertyValue('--vscode-mergeEditor-conflict.unhandledFocused.border'),
                        '--vscode-mergeEditor-conflict.handledUnfocused.border': styles.getPropertyValue('--vscode-mergeEditor-conflict.handledUnfocused.border'),
                        '--vscode-mergeEditor-conflict.handledFocused.border': styles.getPropertyValue('--vscode-mergeEditor-conflict.handledFocused.border'),
                        '--vscode-mergeEditor-conflict.handled.minimapOverViewRuler': styles.getPropertyValue('--vscode-mergeEditor-conflict.handled.minimapOverViewRuler'),
                        '--vscode-mergeEditor-conflict.unhandled.minimapOverViewRuler': styles.getPropertyValue('--vscode-mergeEditor-conflict.unhandled.minimapOverViewRuler'),
                        '--vscode-mergeEditor-conflictingLines.background': styles.getPropertyValue('--vscode-mergeEditor-conflictingLines.background'),
                        '--vscode-mergeEditor-conflict.input1.background': styles.getPropertyValue('--vscode-mergeEditor-conflict.input1.background'),
                        '--vscode-mergeEditor-conflict.input2.background': styles.getPropertyValue('--vscode-mergeEditor-conflict.input2.background'),

                        // Welcome page
                        '--vscode-welcomePage-tileBackground': styles.getPropertyValue('--vscode-welcomePage-tileBackground'),
                        '--vscode-welcomePage-tileHoverBackground': styles.getPropertyValue('--vscode-welcomePage-tileHoverBackground'),
                        '--vscode-welcomePage-tileBorder': styles.getPropertyValue('--vscode-welcomePage-tileBorder'),
                        '--vscode-welcomePage-progress.background': styles.getPropertyValue('--vscode-welcomePage-progress.background'),
                        '--vscode-welcomePage-progress.foreground': styles.getPropertyValue('--vscode-welcomePage-progress.foreground'),

                        // Walkthrough
                        '--vscode-walkthrough-stepTitle.foreground': styles.getPropertyValue('--vscode-walkthrough-stepTitle.foreground'),
                        '--vscode-walkThrough-embeddedEditorBackground': styles.getPropertyValue('--vscode-walkThrough-embeddedEditorBackground'),

                        // Profiles
                        '--vscode-profiles-sashBorder': styles.getPropertyValue('--vscode-profiles-sashBorder'),

                        // Git decoration
                        '--vscode-gitDecoration-addedResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-addedResourceForeground'),
                        '--vscode-gitDecoration-modifiedResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-modifiedResourceForeground'),
                        '--vscode-gitDecoration-deletedResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-deletedResourceForeground'),
                        '--vscode-gitDecoration-renamedResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-renamedResourceForeground'),
                        '--vscode-gitDecoration-untrackedResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-untrackedResourceForeground'),
                        '--vscode-gitDecoration-ignoredResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-ignoredResourceForeground'),
                        '--vscode-gitDecoration-stageModifiedResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-stageModifiedResourceForeground'),
                        '--vscode-gitDecoration-stageDeletedResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-stageDeletedResourceForeground'),
                        '--vscode-gitDecoration-conflictingResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-conflictingResourceForeground'),
                        '--vscode-gitDecoration-submoduleResourceForeground': styles.getPropertyValue('--vscode-gitDecoration-submoduleResourceForeground'),

                        // SCM graph
                        '--vscode-scmGraph-historyItemRefColor': styles.getPropertyValue('--vscode-scmGraph-historyItemRefColor'),
                        '--vscode-scmGraph-historyItemRemoteRefColor': styles.getPropertyValue('--vscode-scmGraph-historyItemRemoteRefColor'),
                        '--vscode-scmGraph-historyItemBaseRefColor': styles.getPropertyValue('--vscode-scmGraph-historyItemBaseRefColor'),
                        '--vscode-scmGraph-historyItemHoverDefaultLabelForeground': styles.getPropertyValue('--vscode-scmGraph-historyItemHoverDefaultLabelForeground'),
                        '--vscode-scmGraph-historyItemHoverDefaultLabelBackground': styles.getPropertyValue('--vscode-scmGraph-historyItemHoverDefaultLabelBackground'),
                        '--vscode-scmGraph-historyItemHoverLabelForeground': styles.getPropertyValue('--vscode-scmGraph-historyItemHoverLabelForeground'),
                        '--vscode-scmGraph-historyItemHoverAdditionsForeground': styles.getPropertyValue('--vscode-scmGraph-historyItemHoverAdditionsForeground'),
                        '--vscode-scmGraph-historyItemHoverDeletionsForeground': styles.getPropertyValue('--vscode-scmGraph-historyItemHoverDeletionsForeground'),
                        '--vscode-scmGraph-foreground1': styles.getPropertyValue('--vscode-scmGraph-foreground1'),
                        '--vscode-scmGraph-foreground2': styles.getPropertyValue('--vscode-scmGraph-foreground2'),
                        '--vscode-scmGraph-foreground3': styles.getPropertyValue('--vscode-scmGraph-foreground3'),
                        '--vscode-scmGraph-foreground4': styles.getPropertyValue('--vscode-scmGraph-foreground4'),
                        '--vscode-scmGraph-foreground5': styles.getPropertyValue('--vscode-scmGraph-foreground5'),

                        // Settings
                        '--vscode-settings-headerForeground': styles.getPropertyValue('--vscode-settings-headerForeground'),
                        '--vscode-settings-settingsHeaderHoverForeground': styles.getPropertyValue('--vscode-settings-settingsHeaderHoverForeground'),
                        '--vscode-settings-modifiedItemIndicator': styles.getPropertyValue('--vscode-settings-modifiedItemIndicator'),
                        '--vscode-settings-headerBorder': styles.getPropertyValue('--vscode-settings-headerBorder'),
                        '--vscode-settings-sashBorder': styles.getPropertyValue('--vscode-settings-sashBorder'),
                        '--vscode-settings-dropdownBackground': styles.getPropertyValue('--vscode-settings-dropdownBackground'),
                        '--vscode-settings-dropdownForeground': styles.getPropertyValue('--vscode-settings-dropdownForeground'),
                        '--vscode-settings-dropdownBorder': styles.getPropertyValue('--vscode-settings-dropdownBorder'),
                        '--vscode-settings-dropdownListBorder': styles.getPropertyValue('--vscode-settings-dropdownListBorder'),
                        '--vscode-settings-checkboxBackground': styles.getPropertyValue('--vscode-settings-checkboxBackground'),
                        '--vscode-settings-checkboxForeground': styles.getPropertyValue('--vscode-settings-checkboxForeground'),
                        '--vscode-settings-checkboxBorder': styles.getPropertyValue('--vscode-settings-checkboxBorder'),
                        '--vscode-settings-textInputBackground': styles.getPropertyValue('--vscode-settings-textInputBackground'),
                        '--vscode-settings-textInputForeground': styles.getPropertyValue('--vscode-settings-textInputForeground'),
                        '--vscode-settings-textInputBorder': styles.getPropertyValue('--vscode-settings-textInputBorder'),
                        '--vscode-settings-numberInputBackground': styles.getPropertyValue('--vscode-settings-numberInputBackground'),
                        '--vscode-settings-numberInputForeground': styles.getPropertyValue('--vscode-settings-numberInputForeground'),
                        '--vscode-settings-numberInputBorder': styles.getPropertyValue('--vscode-settings-numberInputBorder'),
                        '--vscode-settings-focusedRowBackground': styles.getPropertyValue('--vscode-settings-focusedRowBackground'),
                        '--vscode-settings-rowHoverBackground': styles.getPropertyValue('--vscode-settings-rowHoverBackground'),
                        '--vscode-settings-focusedRowBorder': styles.getPropertyValue('--vscode-settings-focusedRowBorder'),

                        // Multi diff editor
                        '--vscode-multiDiffEditor-headerBackground': styles.getPropertyValue('--vscode-multiDiffEditor-headerBackground'),
                        '--vscode-multiDiffEditor-background': styles.getPropertyValue('--vscode-multiDiffEditor-background'),
                        '--vscode-multiDiffEditor-border': styles.getPropertyValue('--vscode-multiDiffEditor-border'),

                        // Interactive
                        '--vscode-interactive-activeCodeBorder': styles.getPropertyValue('--vscode-interactive-activeCodeBorder'),
                        '--vscode-interactive-inactiveCodeBorder': styles.getPropertyValue('--vscode-interactive-inactiveCodeBorder'),

                        // Testing
                        '--vscode-testing-iconFailed': styles.getPropertyValue('--vscode-testing-iconFailed'),
                        '--vscode-testing-iconErrored': styles.getPropertyValue('--vscode-testing-iconErrored'),
                        '--vscode-testing-iconPassed': styles.getPropertyValue('--vscode-testing-iconPassed'),
                        '--vscode-testing-runAction': styles.getPropertyValue('--vscode-testing-runAction'),
                        '--vscode-testing-iconQueued': styles.getPropertyValue('--vscode-testing-iconQueued'),
                        '--vscode-testing-iconUnset': styles.getPropertyValue('--vscode-testing-iconUnset'),
                        '--vscode-testing-iconSkipped': styles.getPropertyValue('--vscode-testing-iconSkipped'),
                        '--vscode-testing-peekBorder': styles.getPropertyValue('--vscode-testing-peekBorder'),
                        '--vscode-testing-messagePeekBorder': styles.getPropertyValue('--vscode-testing-messagePeekBorder'),
                        '--vscode-testing-peekHeaderBackground': styles.getPropertyValue('--vscode-testing-peekHeaderBackground'),
                        '--vscode-testing-messagePeekHeaderBackground': styles.getPropertyValue('--vscode-testing-messagePeekHeaderBackground'),
                        '--vscode-testing-coveredBackground': styles.getPropertyValue('--vscode-testing-coveredBackground'),
                        '--vscode-testing-coveredBorder': styles.getPropertyValue('--vscode-testing-coveredBorder'),
                        '--vscode-testing-coveredGutterBackground': styles.getPropertyValue('--vscode-testing-coveredGutterBackground'),
                        '--vscode-testing-uncoveredBranchBackground': styles.getPropertyValue('--vscode-testing-uncoveredBranchBackground'),
                        '--vscode-testing-uncoveredBackground': styles.getPropertyValue('--vscode-testing-uncoveredBackground'),
                        '--vscode-testing-uncoveredBorder': styles.getPropertyValue('--vscode-testing-uncoveredBorder'),
                        '--vscode-testing-uncoveredGutterBackground': styles.getPropertyValue('--vscode-testing-uncoveredGutterBackground'),
                        '--vscode-testing-coverCountBadgeBackground': styles.getPropertyValue('--vscode-testing-coverCountBadgeBackground'),
                        '--vscode-testing-coverCountBadgeForeground': styles.getPropertyValue('--vscode-testing-coverCountBadgeForeground'),
                        '--vscode-testing-message.error.badgeBackground': styles.getPropertyValue('--vscode-testing-message.error.badgeBackground'),
                        '--vscode-testing-message.error.badgeBorder': styles.getPropertyValue('--vscode-testing-message.error.badgeBorder'),
                        '--vscode-testing-message.error.badgeForeground': styles.getPropertyValue('--vscode-testing-message.error.badgeForeground'),
                        '--vscode-testing-message.info.decorationForeground': styles.getPropertyValue('--vscode-testing-message.info.decorationForeground'),
                        '--vscode-testing-iconErrored.retired': styles.getPropertyValue('--vscode-testing-iconErrored.retired'),
                        '--vscode-testing-iconFailed.retired': styles.getPropertyValue('--vscode-testing-iconFailed.retired'),
                        '--vscode-testing-iconPassed.retired': styles.getPropertyValue('--vscode-testing-iconPassed.retired'),
                        '--vscode-testing-iconQueued.retired': styles.getPropertyValue('--vscode-testing-iconQueued.retired'),
                        '--vscode-testing-iconUnset.retired': styles.getPropertyValue('--vscode-testing-iconUnset.retired'),
                        '--vscode-testing-iconSkipped.retired': styles.getPropertyValue('--vscode-testing-iconSkipped.retired'),

                        // Ports
                        '--vscode-ports-iconRunningProcessForeground': styles.getPropertyValue('--vscode-ports-iconRunningProcessForeground'),

                        // Simple find widget
                        '--vscode-simpleFindWidget-sashBorder': styles.getPropertyValue('--vscode-simpleFindWidget-sashBorder'),

                        // Git blame
                        '--vscode-git-blame.editorDecorationForeground': styles.getPropertyValue('--vscode-git-blame.editorDecorationForeground'),
                    };
                    iframe.contentWindow.postMessage({ type: 'vscode-theme', vars }, '*');
                }

                // MutationObserver for style changes
                const observer = new MutationObserver(() => {
                    sendVSCodeVars();
                });
                observer.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['style'],
                    subtree: false,
                });

                // Fallback polling for theme changes
                let lastBg = '';
                setInterval(() => {
                    const bg = getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background');
                    if (bg !== lastBg) {
                        lastBg = bg;
                        sendVSCodeVars();
                    }
                }, 500);
                // --- END THEME SYNC LOGIC ---
            </script>
        </body>
        </html>`;
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(
    extensionUri: Uri,
    portLoader: () => number,
    reporter: TelemetryReporter,
  ) {
    if (WebviewPanelHost.currentPanel) {
      // If the webview panel already exists reveal it
      WebviewPanelHost.currentPanel._panel.reveal(ViewColumn.Beside);

      // Check if we have a port from LSP and update if needed
      const currentPort = getPlaygroundPort();
      if (currentPort && !WebviewPanelHost.currentPanel.playgroundPort) {
        WebviewPanelHost.currentPanel.updatePlaygroundPort(currentPort);
      }
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = vscode.window.createWebviewPanel(
        // Panel view type
        'showHelloWorld',
        // Panel title
        'BAML Playground',
        // The editor column the panel should be displayed in
        // process.env.VSCODE_DEBUG_MODE === 'true' ? ViewColumn.Two : ViewColumn.Beside,
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },

        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,

          // Restrict the webview to only load resources from the `out` and `web-panel/dist` directories
          localResourceRoots: [
            ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri),
            vscode.Uri.joinPath(extensionUri, 'out'),
            vscode.Uri.joinPath(extensionUri, 'playground/dist'),
          ],
          retainContextWhenHidden: true,
          enableCommandUris: true,
        },
      );

      WebviewPanelHost.currentPanel = new WebviewPanelHost(
        panel,
        extensionUri,
        portLoader,
        reporter,
      );

      // Check if we already have a port from LSP and update immediately
      const currentPort = getPlaygroundPort();
      if (currentPort) {
        WebviewPanelHost.currentPanel.updatePlaygroundPort(currentPort);
      }
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    WebviewPanelHost.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    const config = workspace.getConfiguration();
    config.update('baml.bamlPanelOpen', false, true);

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
