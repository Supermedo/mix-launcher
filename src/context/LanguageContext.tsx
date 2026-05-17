import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { en } from '../locales/en'
import { ar } from '../locales/ar'

type Language = 'en' | 'ar'
type Translations = typeof en

// Helper to access nested keys string
function getNestedValue(obj: any, path: string): string {
    return path.split('.').reduce((prev, curr) => prev ? prev[curr] : null, obj) || path
}

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: (key: string) => string
    dir: 'ltr' | 'rtl'
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider: React.FC<{
    children: ReactNode,
    initialLanguage?: Language
}> = ({ children, initialLanguage = 'en' }) => {
    const [language, setLanguageState] = useState<Language>(initialLanguage)

    useEffect(() => {
        if (initialLanguage) {
            setLanguageState(initialLanguage)
        }
    }, [initialLanguage])

    // Update document direction
    useEffect(() => {
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = language
    }, [language])

    const t = (key: string): string => {
        const translations = language === 'ar' ? ar : en
        return getNestedValue(translations, key)
    }

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage: setLanguageState,
            t,
            dir: language === 'ar' ? 'rtl' : 'ltr'
        }}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLanguage = () => {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}
