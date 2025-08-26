'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

declare global {
    interface Window {
        paypal: any;
    }
}

const PayPalButton = ({ onPaymentSuccess }: { onPaymentSuccess: () => void }) => {
    const paypalRef = useRef<HTMLDivElement>(null);
    const locale = 'en'; // Hardcode to english for now

    useEffect(() => {
        if (window.paypal) {
            window.paypal.Buttons({
                createOrder: async (data, actions) => {
                    try {
                        const { data: functionData, error } = await supabase.functions.invoke('create-paypal-order', {
                            body: { locale }
                        });
                        if (error) {
                            throw new Error(error.message);
                        }
                        return functionData.orderId;
                    } catch (err) {
                        toast.error('Could not initiate PayPal payment.');
                        console.error(err);
                        return null;
                    }
                },
                onApprove: async (data, actions) => {
                    toast.success('Payment approved! Please wait while we verify...');
                    onPaymentSuccess();
                    return actions.order.capture();
                },
                onError: (err) => {
                    toast.error('An error occurred with the PayPal payment.');
                    console.error('PayPal Error:', err);
                },
            }).render(paypalRef.current);
        } else {
            console.error("PayPal SDK not loaded.");
        }
    }, [locale, onPaymentSuccess]);

    return <div ref={paypalRef}></div>;
};

export default PayPalButton;