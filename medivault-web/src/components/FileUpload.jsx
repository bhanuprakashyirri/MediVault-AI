import React, { useState, useRef } from 'react';
import { CloudUpload, FileText, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FileUpload = ({ onFileSelect, isParsing }) => {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const inputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setSelectedFile(file);
            onFileSelect(file);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            onFileSelect(file);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4">
            <div
                className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center
          ${dragActive ? 'border-[#00B4D8] bg-[#E0F7FF] scale-[1.02]' : 'border-gray-300 bg-gray-50'}
          ${isParsing ? 'opacity-50 pointer-events-none' : 'hover:border-[#00B4D8] hover:bg-gray-100'}
        `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <motion.div
                    animate={dragActive ? { y: [0, -10, 0] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="mb-4 text-[#00B4D8]"
                >
                    <CloudUpload size={48} />
                </motion.div>

                <h3 className="text-lg font-semibold text-gray-700 mb-1">
                    Drag & Drop your medical document here
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                    Supports PDF, JPG, PNG — Max 10MB
                </p>

                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleChange}
                />

                <button
                    onClick={() => inputRef.current.click()}
                    className="bg-[#00B4D8] hover:bg-[#0096C7] text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm active:scale-95"
                    disabled={isParsing}
                >
                    <FileText size={18} />
                    Upload Document
                </button>

                {selectedFile && (
                    <div className="mt-6 flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100 w-full max-w-md">
                        <div className="bg-[#E0F7FF] p-2 rounded text-[#00B4D8]">
                            <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                        </div>
                    </div>
                )}

                {dragActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 border-4 border-[#00B4D8] rounded-xl animate-pulse pointer-events-none"
                    />
                )}
            </div>
        </div>
    );
};

export default FileUpload;
