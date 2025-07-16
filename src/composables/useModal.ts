import {ref} from "vue";

const component = ref();
const props = ref();
const show = ref(false);

export function useModal() {
    return {
        component,
        props,
        show,
        showModal: () => show.value = true,
        hideModal: () => {
            props.value = ref();
            show.value = false;
        }
    }
}