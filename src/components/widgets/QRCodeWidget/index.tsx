import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
} from '@boxento/primitives';
import WidgetHeader from '../common/WidgetHeader';
import type { QRCodeWidgetProps } from './types';

const QRCodeWidget: React.FC<QRCodeWidgetProps> = ({ width, height, config }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [content, setContent] = useState(config?.content || '');
  const [inputContent, setInputContent] = useState(config?.content || '');
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Calculate QR code size based on widget dimensions
  const getQRSize = () => {
    const baseSize = Math.min(width, height);
    if (baseSize <= 2) return 100;
    if (baseSize <= 3) return 140;
    return 180;
  };

  // Save settings
  const handleSave = () => {
    setContent(inputContent.trim());

    if (config?.onUpdate) {
      config.onUpdate({
        ...config,
        content: inputContent.trim()
      });
    }
    setShowSettings(false);
  };

  // Download QR code as PNG
  const handleDownload = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = 'qrcode.png';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Copy content to clipboard
  const handleCopy = async () => {
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Render setup view when no content configured
  const renderSetup = () => (
    <div className="h-full flex flex-col items-center justify-center text-center p-4">
      <QrCode size={32} className="text-gray-400 mb-3" strokeWidth={1.5} />
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Generate a QR code
      </p>
      <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
        Add Content
      </Button>
    </div>
  );

  // Render QR code display
  const renderQRCode = () => {
    if (!content) return renderSetup();

    const qrSize = getQRSize();
    const isCompact = width <= 2 && height <= 2;

    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div ref={qrRef} className="bg-white p-2 rounded-lg">
          <QRCodeSVG
            value={content}
            size={qrSize}
            level="M"
            includeMargin={false}
          />
        </div>

        {!isCompact && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDownload}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Download PNG"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Copy content"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>
        )}

        {!isCompact && content.length <= 50 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center truncate max-w-full px-2">
            {content}
          </div>
        )}
      </div>
    );
  };

  // Settings dialog
  const renderSettings = () => (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content (URL or text)</Label>
            <textarea
              id="content"
              placeholder="https://example.com or any text"
              value={inputContent}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputContent(e.target.value)}
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter a URL, text, phone number, or any content to encode
            </p>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Tips:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>URL: https://example.com</li>
              <li>Phone: tel:+1234567890</li>
              <li>Email: mailto:email@example.com</li>
              <li>WiFi: WIFI:T:WPA;S:NetworkName;P:Password;;</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            {config?.onDelete && (
              <Button variant="destructive" onClick={config.onDelete}>
                Delete
              </Button>
            )}
            {!config?.onDelete && <div />}
            <Button onClick={handleSave}>
              Generate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="widget-container h-full flex flex-col">
      <WidgetHeader
        title={config?.title || 'QR Code'}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex-grow overflow-hidden p-3">
        {renderQRCode()}
      </div>

      {renderSettings()}
    </div>
  );
};

export default QRCodeWidget;
