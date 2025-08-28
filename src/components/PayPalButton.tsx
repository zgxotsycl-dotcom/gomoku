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

    useEffect(() => {
        if (paypalRef.current && paypalRef.current.childNodes.length === 0 && window.paypal) {
            try {
                window.paypal.Buttons({
                    createOrder: async (data: any, actions: any) => {
                        try {
                            const { data: functionData, error } = await supabase.functions.invoke('create-paypal-order');
                            if (error) {
                                console.error("Supabase function returned an error:", error);
                                throw new Error(error.message);
                            }
                            return functionData.orderId;
                        } catch (err) {
                            toast.error('Could not initiate PayPal payment.');
                            console.error(err);
                            return '';
                        }
                    },
                    onApprove: async (data: any, actions: any) => {
                        toast.success('Payment approved! Please wait while we verify...');
                        // Here you would typically call another function to verify the payment on your backend
                        // and grant supporter status.
                        onPaymentSuccess();
                        return actions.order.capture();
                    },
                    onError: (err: any) => {
                        toast.error('An error occurred with the PayPal payment.');
                        console.error('PayPal Error:', err);
                    },
                }).render(paypalRef.current);
            } catch (error) {
                console.error("Failed to render PayPal buttons:", error);
            }
        } else if (!window.paypal) {
            console.error("PayPal SDK not loaded.");
        }
    }, [onPaymentSuccess]);

    return <div ref={paypalRef}></div>;
};

export default PayPalButton;
