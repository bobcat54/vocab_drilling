'use client';

// Smart CSV uploader with auto-detection, preview, and import progress

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useVocabStore } from '@/store/useVocabStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { parseCSV, convertToCSVRows, hasHeader, type ParsedData } from '@/lib/csv-parser';

export function CSVUploader() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'preview' | 'importing' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [skipHeader, setSkipHeader] = useState(true);

  const { importWords, importProgress } = useVocabStore();

  const handleFileContent = useCallback((content: string) => {
    setErrorMessage(null);

    try {
      // Parse with smart detection
      const data = parseCSV(content);

      if (data.rows.length === 0) {
        setErrorMessage('No data found in file');
        return;
      }

      if (data.rows[0].length < 2) {
        setErrorMessage('File must have at least 2 columns');
        return;
      }

      // Auto-detect if first row is header
      setSkipHeader(hasHeader(data.rows));

      setParsedData(data);
      setUploadStatus('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to parse file');
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        handleFileContent(content);
      };
      reader.onerror = () => {
        setErrorMessage('Failed to read file');
      };
      reader.readAsText(file);
    },
    [handleFileContent]
  );

  const handlePastedText = useCallback(
    (text: string) => {
      handleFileContent(text);
    },
    [handleFileContent]
  );

  const handleConfirmImport = useCallback(async () => {
    if (!parsedData) return;

    try {
      const csvRows = convertToCSVRows(parsedData, skipHeader);

      if (csvRows.length === 0) {
        setErrorMessage('No valid word pairs found');
        return;
      }

      setUploadStatus('importing');
      await importWords(csvRows);
      setUploadStatus('success');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Error importing words:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import words');
      setUploadStatus('preview');
    }
  }, [parsedData, skipHeader, importWords, router]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const previewRows = parsedData ? parsedData.rows.slice(0, 5) : [];
  const { portugueseColumn, englishColumn, confidence } = parsedData?.detectedMapping || {
    portugueseColumn: 0,
    englishColumn: 1,
    confidence: 'low',
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Upload Vocabulary</CardTitle>
        <CardDescription>
          Upload CSV, TSV, or paste text. We'll auto-detect the columns.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {uploadStatus === 'idle' && (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative rounded-lg border-2 border-dashed p-12 text-center transition-colors
                ${
                  isDragging
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600'
                }
              `}
            >
              <svg
                className="mx-auto mb-4 h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mb-2 text-lg font-medium">Drag and drop file here</p>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                CSV, TSV, or any delimited text file
              </p>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileInput}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-green-600 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-green-700 min-h-[44px]">
                  Select File
              </label>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium">Or paste text directly:</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm dark:border-gray-600 dark:bg-gray-700"
                rows={6}
                placeholder="olá,hello&#10;obrigado,thank you&#10;bom dia,good morning"
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text');
                  handlePastedText(text);
                }}
              />
            </div>
          </>
        )}

        {uploadStatus === 'preview' && parsedData && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="mb-2 font-medium">
                Detected mapping ({confidence} confidence):
              </p>
              <div className="flex gap-4 text-sm">
                <span>
                  <strong>Portuguese:</strong> Column {portugueseColumn + 1}
                </span>
                <span>
                  <strong>English:</strong> Column {englishColumn + 1}
                </span>
                <span>
                  <strong>Delimiter:</strong> {parsedData.delimiter === '\t' ? 'Tab' : parsedData.delimiter}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-3">
                <label className="text-sm font-medium">Preview (first 5 rows):</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skipHeader}
                    onChange={(e) => setSkipHeader(e.target.checked)}
                  />
                  First row is header
                </label>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-600">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left">Portuguese</th>
                      <th className="px-4 py-2 text-left">English</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => {
                      if (idx === 0 && skipHeader) {
                        return (
                          <tr key={idx} className="bg-yellow-50 opacity-50 dark:bg-yellow-900/20">
                            <td className="px-4 py-2">{row[portugueseColumn]}</td>
                            <td className="px-4 py-2">{row[englishColumn]}</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="px-4 py-2">{row[portugueseColumn]}</td>
                          <td className="px-4 py-2">{row[englishColumn]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Total: {parsedData.rows.length - (skipHeader ? 1 : 0)} word pairs
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="primary" onClick={handleConfirmImport}>
                Confirm & Import
              </Button>
              <Button variant="outline" onClick={() => setUploadStatus('idle')}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {uploadStatus === 'importing' && (
          <div className="flex flex-col items-center py-12">
            <div className="mb-6 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-cyan-500" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              Generating sentences...
            </p>
            {importProgress && (
              <>
                <p className="mt-2 text-2xl font-bold text-cyan-600">
                  {importProgress.current}/{importProgress.total}
                </p>
                <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  This may take a minute for large word lists
                </p>
              </>
            )}
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="flex flex-col items-center py-12 text-green-600">
            <svg className="mb-4 h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xl font-medium">Import successful!</p>
            <p className="mt-2 text-sm text-gray-500">Redirecting to dashboard...</p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200">
            <p className="font-medium">Error</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
