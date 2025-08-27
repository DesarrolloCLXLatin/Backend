// src/components/tickets/IframeTicketPurchase/components/PaymentMethods/FileUploadField.tsx

import React, { useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploadFieldProps {
  label: string;
  onChange: (file: File | null) => void;
  accept?: string;
  error?: string | null;
  maxSizeMB?: number;
}

const FileUploadField: React.FC<FileUploadFieldProps> = ({ 
  label, 
  onChange, 
  accept = "image/*,.pdf",
  error,
  maxSizeMB = 5
}) => {
  const [fileName, setFileName] = useState('');
  const [fileId] = useState(`file-upload-${Math.random().toString(36).substr(2, 9)}`);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onChange(file);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300">
        {label}
      </label>
      <div className="border-2 border-dashed border-gray-600 rounded-xl p-6 text-center">
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          id={fileId}
        />
        <label htmlFor={fileId} className="cursor-pointer">
          {fileName ? (
            <div className="space-y-2">
              <FileText className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-green-400 font-medium">{fileName}</p>
              <p className="text-sm text-gray-500">Click para cambiar archivo</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-300">Click para subir comprobante</p>
              <p className="text-sm text-gray-500 mt-1">JPG, PNG o PDF (Max {maxSizeMB}MB)</p>
            </>
          )}
        </label>
      </div>
      {error && (
        <p className="text-red-400 text-sm flex items-center gap-1 animate-shake">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
};

export default FileUploadField;