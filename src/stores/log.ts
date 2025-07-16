import { defineStore } from "pinia";

export const useLogStore = defineStore('log', {
    state: () => ({
        logs: [] as string[],
    }),
    actions: {
        addLog(value: string) {
            this.logs.unshift(value);
        }
    }
})