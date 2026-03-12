import React from 'react';
import { CheckCircle, XCircle, FileText, Bot, AlertCircle, RotateCcw, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

const ParseResult = ({ result, error, fileName, onReset, onNavigateToAI }) => {
    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md mx-auto mt-6 bg-[#FFF5F5] border border-red-100 p-6 rounded-xl shadow-sm"
            >
                <div className="flex items-start gap-3 mb-4">
                    <div className="bg-red-100 p-2 rounded-full text-red-500">
                        <XCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-800">Could not read this document</h3>
                        <p className="text-sm text-red-600 mt-1">Reason: {error.message}</p>
                    </div>
                </div>

                <div className="bg-white/50 p-3 rounded-lg flex items-center gap-2 mb-6">
                    <AlertCircle size={16} className="text-red-400" />
                    <p className="text-xs text-red-700">💡 Try: {error.message.includes('quality') ? 'Upload a clearer photo' : 'Ensure the file is not corrupted'}</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onReset}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                        <RotateCcw size={16} />
                        Try Again
                    </button>
                    <button
                        onClick={onReset}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#00B4D8] text-white rounded-lg text-sm font-medium hover:bg-[#0096C7] transition-colors"
                    >
                        <Upload size={16} />
                        Upload Different
                    </button>
                </div>
            </motion.div>
        );
    }

    if (result) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md mx-auto mt-6 bg-white border border-[#E0F7FF] p-6 rounded-xl shadow-lg"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-green-100 p-2 rounded-full text-green-500">
                        <CheckCircle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Document parsed successfully!</h3>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <FileText size={18} className="text-[#00B4D8]" />
                        <span className="font-medium truncate">{fileName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <FileText size={18} className="text-[#00B4D8]" />
                        <span>{result.length} characters extracted</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 animate-pulse">
                        <Bot size={18} className="text-[#00B4D8]" />
                        <span>Sending to MediVault AI...</span>
                    </div>
                </div>

                <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00B4D8]/30 to-transparent w-1/2"
                    />
                </div>
            </motion.div>
        );
    }

    return null;
};

export default ParseResult;
