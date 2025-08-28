'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

// We declare the paypal object on the window, as it is loaded from an external script.
declare global {
    interface Window {
        paypal: any;
    }
}

const PayPalButton = ({ onPaymentSuccess }: { onPaymentSuccess: () => void }) => {
    const paypalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.paypal) {
            window.paypal.Buttons({
                // Using 'any' to bypass strict type checking for the PayPal SDK arguments
                createOrder: async (data: any, actions: any) => {
                    try {
                        const { data: functionData, error } = await supabase.functions.invoke('create-paypal-order', {
                            body: { locale: 'en' } // Defaulting to 'en' for now
                        });
                        if (error) {
                            console.error("Supabase function returned an error:", error);
                            throw new Error(error.message);
                        }
                        console.log("Data received from Supabase function:", functionData);
                        return functionData.orderId;
                    } catch (err) {
                        toast.error('Could not initiate PayPal payment.');
                        console.error(err);
                        return ''; // Return empty string on failure
                    }
                },
                onApprove: async (data: any, actions: any) => {
                    toast.success('Payment approved! Please wait while we verify...');
                    onPaymentSuccess();
                    return actions.order.capture();
                },
                onError: (err: any) => {
                    toast.error('An error occurred with the PayPal payment.');
                    console.error('PayPal Error:', err);
                },
            }).render(paypalRef.current);
        } else {
            console.error("PayPal SDK not loaded.");
        }
    }, [onPaymentSuccess]);

    return <div ref={paypalRef}></div>;
};

export default PayPalButton;
